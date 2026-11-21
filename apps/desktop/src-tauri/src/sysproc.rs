//! Child-process helpers.
//!
//! ARIA is a GUI application; on Windows every console child process (codex,
//! icacls, taskkill, curl, cmd) would otherwise flash a console window. All
//! spawns go through here so `CREATE_NO_WINDOW` is always applied.

use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// `CREATE_NO_WINDOW` — start the process without a console window.
#[cfg(windows)]
pub const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Create a command with no visible console window on Windows.
pub fn new(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut cmd = Command::new(program);
    hide(&mut cmd);
    cmd
}

/// Apply the no-window flag to an existing command (Windows only).
pub fn hide(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(windows))]
    {
        let _ = cmd;
    }
    cmd
}

#[cfg(all(test, windows))]
mod tests {
    #[test]
    fn console_child_has_no_console_window_and_keeps_piped_output() {
        // This checks the console handle of a real Windows child, not merely
        // the flag constant. No account, network access or Codex is required.
        let output = super::new("powershell.exe")
            .args([
                "-NoProfile", "-NonInteractive", "-Command",
                r#"Add-Type -Name ConsoleProbe -Namespace Aria -MemberDefinition '[DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();'; [Aria.ConsoleProbe]::GetConsoleWindow().ToInt64()"#,
            ])
            .output()
            .expect("start hidden Windows console child");
        assert!(output.status.success(), "console probe failed");
        assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "0");
    }
}
