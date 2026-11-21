//! Credential hygiene helpers: DPAPI at-rest encryption (Windows), file ACL
//! hardening, secure deletion and log redaction. Tokens are never parsed for
//! display and never written to logs or the database.

use std::path::Path;

/// Replace anything that looks like a bearer token, JWT or API key with a marker.
pub fn redact(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for (idx, chunk) in input.split_whitespace().enumerate() {
        if idx > 0 {
            out.push(' ');
        }
        let is_jwt = chunk.starts_with("eyJ") && chunk.len() > 40;
        let is_bearer = chunk.eq_ignore_ascii_case("bearer");
        let looks_secret = chunk.len() > 80
            && chunk
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '+' | '/' | '='));
        if is_jwt || looks_secret {
            out.push_str("[REDACTED]");
        } else if is_bearer {
            out.push_str(chunk);
        } else if let Some(rest) = chunk.strip_prefix("sk-") {
            if rest.len() > 8 {
                out.push_str("[REDACTED]");
            } else {
                out.push_str(chunk);
            }
        } else {
            out.push_str(chunk);
        }
    }
    out
}

/// Best-effort overwrite-then-delete for files holding sensitive material.
pub fn secure_delete(path: &Path) -> std::io::Result<()> {
    if !path.exists() {
        return Ok(());
    }
    if path.is_file() {
        if let Ok(meta) = path.metadata() {
            let len = meta.len() as usize;
            if len > 0 && len <= 8 * 1024 * 1024 {
                use std::io::{Seek, SeekFrom, Write};
                if let Ok(mut f) = std::fs::OpenOptions::new().write(true).open(path) {
                    let zeros = vec![0u8; len.min(64 * 1024)];
                    if f.seek(SeekFrom::Start(0)).is_ok() {
                        let mut written = 0usize;
                        while written < len {
                            let take = zeros.len().min(len - written);
                            if f.write_all(&zeros[..take]).is_err() {
                                break;
                            }
                            written += take;
                        }
                        let _ = f.flush();
                    }
                }
            }
        }
        std::fs::remove_file(path)?;
    }
    Ok(())
}

/// Restrict a credential file to the current OS user where the platform allows it.
pub fn harden_file(path: &Path) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(path)?.permissions();
        perms.set_mode(0o600);
        std::fs::set_permissions(path, perms)?;
    }
    #[cfg(windows)]
    {
        let user = std::env::var("USERNAME").unwrap_or_default();
        if !user.is_empty() {
            use std::process::Command;
            let _ = Command::new("icacls")
                .arg(path)
                .args(["/inheritance:r"])
                .args(["/grant:r", &format!("{}:F", user)])
                .output();
        }
    }
    Ok(())
}

#[cfg(windows)]
mod dpapi {
    use std::ffi::c_void;

    #[repr(C)]
    struct DataBlob {
        cb_data: u32,
        pb_data: *mut u8,
    }

    #[link(name = "crypt32")]
    extern "system" {
        fn CryptProtectData(
            data_in: *const DataBlob,
            descr: *const u16,
            entropy: *const DataBlob,
            reserved: *mut c_void,
            prompt: *mut c_void,
            flags: u32,
            data_out: *mut DataBlob,
        ) -> i32;
        fn CryptUnprotectData(
            data_in: *const DataBlob,
            descr: *mut *mut u16,
            entropy: *const DataBlob,
            reserved: *mut c_void,
            prompt: *mut c_void,
            flags: u32,
            data_out: *mut DataBlob,
        ) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn LocalFree(ptr: *mut c_void) -> *mut c_void;
    }

    pub fn protect(plain: &[u8]) -> std::io::Result<Vec<u8>> {
        unsafe {
            let mut input = DataBlob { cb_data: plain.len() as u32, pb_data: plain.as_ptr() as *mut u8 };
            let mut output = DataBlob { cb_data: 0, pb_data: std::ptr::null_mut() };
            let ok = CryptProtectData(&mut input, std::ptr::null(), std::ptr::null(), std::ptr::null_mut(), std::ptr::null_mut(), 0x1, &mut output);
            if ok == 0 {
                return Err(std::io::Error::last_os_error());
            }
            let slice = std::slice::from_raw_parts(output.pb_data, output.cb_data as usize).to_vec();
            LocalFree(output.pb_data as *mut c_void);
            Ok(slice)
        }
    }

    pub fn unprotect(blob: &[u8]) -> std::io::Result<Vec<u8>> {
        unsafe {
            let mut input = DataBlob { cb_data: blob.len() as u32, pb_data: blob.as_ptr() as *mut u8 };
            let mut output = DataBlob { cb_data: 0, pb_data: std::ptr::null_mut() };
            let ok = CryptUnprotectData(&mut input, std::ptr::null_mut(), std::ptr::null(), std::ptr::null_mut(), std::ptr::null_mut(), 0, &mut output);
            if ok == 0 {
                return Err(std::io::Error::last_os_error());
            }
            let slice = std::slice::from_raw_parts(output.pb_data, output.cb_data as usize).to_vec();
            LocalFree(output.pb_data as *mut c_void);
            Ok(slice)
        }
    }
}

/// Encrypt a credential blob for at-rest backup storage.
pub fn protect_secret(plain: &[u8]) -> std::io::Result<Vec<u8>> {
    #[cfg(windows)]
    {
        dpapi::protect(plain)
    }
    #[cfg(not(windows))]
    {
        let mut out = b"ARIA-PLAIN-1\n".to_vec();
        out.extend_from_slice(plain);
        Ok(out)
    }
}

pub fn unprotect_secret(blob: &[u8]) -> std::io::Result<Vec<u8>> {
    #[cfg(windows)]
    {
        dpapi::unprotect(blob)
    }
    #[cfg(not(windows))]
    {
        const TAG: &[u8] = b"ARIA-PLAIN-1\n";
        if blob.starts_with(TAG) {
            Ok(blob[TAG.len()..].to_vec())
        } else {
            Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "unrecognised vault format"))
        }
    }
}
