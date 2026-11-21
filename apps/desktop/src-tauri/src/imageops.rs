//! Local, non-generative image processing. Every operation here is real local
//! pixel work (no AI upscaling, no fabricated capabilities).

use crate::error::{AppError, AppResult};
use image::{DynamicImage, GenericImageView, ImageBuffer, ImageFormat, Rgba};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::VecDeque;
use std::io::Read;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct ImageInfo {
    pub path: String,
    pub file_name: String,
    pub format: String,
    pub width: u32,
    pub height: u32,
    pub size_bytes: u64,
    pub has_alpha: bool,
    pub sha256: String,
}

pub fn sha256_file(path: &Path) -> AppResult<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 32 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>())
}

pub fn inspect(path: &Path) -> AppResult<ImageInfo> {
    let img = image::open(path)?;
    let (width, height) = img.dimensions();
    let size_bytes = std::fs::metadata(path)?.len();
    let format = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_else(|| "unknown".into());
    Ok(ImageInfo {
        path: path.to_string_lossy().to_string(),
        file_name: crate::paths::file_name_of(path),
        format,
        width,
        height,
        size_bytes,
        has_alpha: img.color().has_alpha(),
        sha256: sha256_file(path)?,
    })
}

pub fn is_image_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default()
            .as_str(),
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "tif" | "tiff"
    )
}

pub fn save_image(img: &DynamicImage, path: &Path, format: &str, quality: u8) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let fmt = match format.to_lowercase().as_str() {
        "jpg" | "jpeg" => ImageFormat::Jpeg,
        "webp" => ImageFormat::WebP,
        "bmp" => ImageFormat::Bmp,
        "gif" => ImageFormat::Gif,
        _ => ImageFormat::Png,
    };
    if fmt == ImageFormat::Jpeg {
        let rgb = img.to_rgb8();
        let file = std::fs::File::create(path)?;
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
            std::io::BufWriter::new(file),
            quality.clamp(30, 100),
        );
        encoder
            .encode_image(&rgb)
            .map_err(|e| AppError::new("encode_failed", e.to_string()))?;
        return Ok(());
    }
    img.save_with_format(path, fmt)?;
    Ok(())
}

pub fn make_thumbnail(src: &Path, dst: &Path, max_edge: u32, quality: u8) -> AppResult<ImageInfo> {
    let img = image::open(src)?;
    let thumb = img.thumbnail(max_edge, max_edge);
    let format = dst
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_else(|| "png".into());
    save_image(&thumb, dst, &format, quality)?;
    inspect(dst)
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct TransformOps {
    pub resize_width: Option<u32>,
    pub resize_height: Option<u32>,
    pub scale: Option<f32>,
    pub brightness: Option<i32>,
    pub contrast: Option<f32>,
    pub saturation: Option<f32>,
    pub sharpen_sigma: Option<f32>,
    pub sharpen_threshold: Option<i32>,
    pub denoise: bool,
    pub white_balance: Option<[f32; 3]>,
    pub grayscale: bool,
    pub flip_horizontal: bool,
    pub flip_vertical: bool,
    pub rotate_degrees: Option<u16>,
    pub remove_background: Option<u8>,
    pub output_format: Option<String>,
    pub quality: Option<u8>,
}

fn median_denoise(img: &DynamicImage) -> DynamicImage {
    let rgb = img.to_rgba8();
    let (w, h) = rgb.dimensions();
    let mut out = ImageBuffer::new(w, h);
    for y in 0..h {
        for x in 0..w {
            let mut channels = [[0u8; 9]; 4];
            let mut counts = [0usize; 4];
            for dy in -1i32..=1 {
                for dx in -1i32..=1 {
                    let px = (x as i32 + dx).clamp(0, w as i32 - 1) as u32;
                    let py = (y as i32 + dy).clamp(0, h as i32 - 1) as u32;
                    let p = rgb.get_pixel(px, py);
                    for c in 0..4 {
                        channels[c][counts[c]] = p[c];
                        counts[c] += 1;
                    }
                }
            }
            let mut pixel = [0u8; 4];
            for c in 0..4 {
                let slice = &mut channels[c][..counts[c]];
                slice.sort_unstable();
                pixel[c] = slice[slice.len() / 2];
            }
            out.put_pixel(x, y, Rgba(pixel));
        }
    }
    DynamicImage::ImageRgba8(out)
}

fn adjust_saturation(img: &DynamicImage, factor: f32) -> DynamicImage {
    let mut rgb = img.to_rgba8();
    for pixel in rgb.pixels_mut() {
        let r = pixel[0] as f32;
        let g = pixel[1] as f32;
        let b = pixel[2] as f32;
        let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        pixel[0] = (luma + (r - luma) * factor).clamp(0.0, 255.0) as u8;
        pixel[1] = (luma + (g - luma) * factor).clamp(0.0, 255.0) as u8;
        pixel[2] = (luma + (b - luma) * factor).clamp(0.0, 255.0) as u8;
    }
    DynamicImage::ImageRgba8(rgb)
}

fn white_balance(img: &DynamicImage, gains: [f32; 3]) -> DynamicImage {
    let mut rgb = img.to_rgba8();
    for pixel in rgb.pixels_mut() {
        pixel[0] = (pixel[0] as f32 * gains[0]).clamp(0.0, 255.0) as u8;
        pixel[1] = (pixel[1] as f32 * gains[1]).clamp(0.0, 255.0) as u8;
        pixel[2] = (pixel[2] as f32 * gains[2]).clamp(0.0, 255.0) as u8;
    }
    DynamicImage::ImageRgba8(rgb)
}

/// Flood-fill background removal starting from border pixels that match the
/// sampled background colour within `tolerance` (0-100).
pub fn remove_background(img: &DynamicImage, tolerance: u8) -> DynamicImage {
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    let mut out = rgba.clone();
    if w == 0 || h == 0 {
        return DynamicImage::ImageRgba8(out);
    }
    // Sample the four corners to estimate the background colour.
    let corners = [
        rgba.get_pixel(0, 0),
        rgba.get_pixel(w - 1, 0),
        rgba.get_pixel(0, h - 1),
        rgba.get_pixel(w - 1, h - 1),
    ];
    let mut bg = [0u32; 3];
    for corner in &corners {
        for c in 0..3 {
            bg[c] += corner[c] as u32;
        }
    }
    let bg = [bg[0] as f32 / 4.0, bg[1] as f32 / 4.0, bg[2] as f32 / 4.0];
    let tol = (tolerance as f32 / 100.0 * 255.0).max(4.0);
    let matches_bg = |p: &Rgba<u8>| {
        let dr = p[0] as f32 - bg[0];
        let dg = p[1] as f32 - bg[1];
        let db = p[2] as f32 - bg[2];
        (dr * dr + dg * dg + db * db).sqrt() <= tol
    };
    let mut visited = vec![false; (w * h) as usize];
    let mut queue: VecDeque<(u32, u32)> = VecDeque::new();
    let mut push = |x: u32, y: u32, visited: &mut Vec<bool>, queue: &mut VecDeque<(u32, u32)>| {
        let idx = (y * w + x) as usize;
        if !visited[idx] {
            visited[idx] = true;
            queue.push_back((x, y));
        }
    };
    for x in 0..w {
        push(x, 0, &mut visited, &mut queue);
        push(x, h - 1, &mut visited, &mut queue);
    }
    for y in 0..h {
        push(0, y, &mut visited, &mut queue);
        push(w - 1, y, &mut visited, &mut queue);
    }
    while let Some((x, y)) = queue.pop_front() {
        let pixel = *rgba.get_pixel(x, y);
        if !matches_bg(&pixel) {
            continue;
        }
        out.put_pixel(x, y, Rgba([pixel[0], pixel[1], pixel[2], 0]));
        if x > 0 {
            push(x - 1, y, &mut visited, &mut queue);
        }
        if y > 0 {
            push(x, y - 1, &mut visited, &mut queue);
        }
        if x + 1 < w {
            push(x + 1, y, &mut visited, &mut queue);
        }
        if y + 1 < h {
            push(x, y + 1, &mut visited, &mut queue);
        }
    }
    DynamicImage::ImageRgba8(out)
}

pub fn apply_ops(src: &Path, dst: &Path, ops: &TransformOps) -> AppResult<ImageInfo> {
    let mut img = image::open(src)?;
    if let Some(tolerance) = ops.remove_background {
        img = remove_background(&img, tolerance);
    }
    if let Some(sigma) = ops.sharpen_sigma {
        if sigma > 0.0 {
            img = img.unsharpen(sigma, ops.sharpen_threshold.unwrap_or(2));
        }
    }
    if ops.denoise {
        img = median_denoise(&img);
    }
    if let Some(brightness) = ops.brightness {
        if brightness != 0 {
            img = img.brighten(brightness);
        }
    }
    if let Some(contrast) = ops.contrast {
        if (contrast - 1.0).abs() > f32::EPSILON {
            img = img.adjust_contrast(contrast);
        }
    }
    if let Some(saturation) = ops.saturation {
        if (saturation - 1.0).abs() > f32::EPSILON {
            img = adjust_saturation(&img, saturation);
        }
    }
    if let Some(gains) = ops.white_balance {
        img = white_balance(&img, gains);
    }
    if ops.grayscale {
        img = img.grayscale();
    }
    if ops.flip_horizontal {
        img = img.fliph();
    }
    if ops.flip_vertical {
        img = img.flipv();
    }
    if let Some(degrees) = ops.rotate_degrees {
        img = match degrees % 360 {
            90 => img.rotate90(),
            180 => img.rotate180(),
            270 => img.rotate270(),
            _ => img,
        };
    }
    let (mut width, mut height) = img.dimensions();
    if let Some(scale) = ops.scale {
        if scale > 0.01 && (scale - 1.0).abs() > 0.001 {
            width = ((width as f32) * scale).round().max(1.0) as u32;
            height = ((height as f32) * scale).round().max(1.0) as u32;
            img = img.resize(width, height, image::imageops::FilterType::Lanczos3);
        }
    }
    if ops.resize_width.is_some() || ops.resize_height.is_some() {
        let target_w = ops.resize_width.unwrap_or(0);
        let target_h = ops.resize_height.unwrap_or(0);
        let (w, h) = img.dimensions();
        let (w, h) = match (target_w, target_h) {
            (w2, 0) if w2 > 0 => (w2, ((h as f32) * (w2 as f32 / w as f32)).round().max(1.0) as u32),
            (0, h2) if h2 > 0 => (((w as f32) * (h2 as f32 / h as f32)).round().max(1.0) as u32, h2),
            (w2, h2) if w2 > 0 && h2 > 0 => (w2, h2),
            _ => (w, h),
        };
        img = img.resize_exact(w, h, image::imageops::FilterType::Lanczos3);
    }
    let format = ops
        .output_format
        .clone()
        .or_else(|| dst.extension().map(|e| e.to_string_lossy().to_string()))
        .unwrap_or_else(|| "png".into());
    save_image(&img, dst, &format, ops.quality.unwrap_or(92))?;
    inspect(dst)
}

#[derive(Debug, Clone, Serialize)]
pub struct Comparison {
    pub width_a: u32,
    pub height_a: u32,
    pub width_b: u32,
    pub height_b: u32,
    pub same_dimensions: bool,
    pub mean_absolute_difference: f32,
    pub identical: bool,
}

pub fn compare(a: &Path, b: &Path) -> AppResult<Comparison> {
    let ia = image::open(a)?;
    let ib = image::open(b)?;
    let (wa, ha) = ia.dimensions();
    let (wb, hb) = ib.dimensions();
    let same_dimensions = wa == wb && ha == hb;
    if !same_dimensions {
        return Ok(Comparison {
            width_a: wa,
            height_a: ha,
            width_b: wb,
            height_b: hb,
            same_dimensions,
            mean_absolute_difference: -1.0,
            identical: false,
        });
    }
    let ra = ia.to_rgba8();
    let rb = ib.to_rgba8();
    let mut total: u64 = 0;
    for (pa, pb) in ra.pixels().zip(rb.pixels()) {
        for c in 0..3 {
            total += (pa[c] as i32 - pb[c] as i32).unsigned_abs() as u64;
        }
    }
    let count = (wa as u64) * (ha as u64) * 3;
    let mean = if count == 0 { 0.0 } else { total as f32 / count as f32 };
    Ok(Comparison {
        width_a: wa,
        height_a: ha,
        width_b: wb,
        height_b: hb,
        same_dimensions,
        mean_absolute_difference: mean,
        identical: mean < 0.01,
    })
}

pub fn unique_path(dir: &Path, stem: &str, ext: &str) -> PathBuf {
    let mut candidate = dir.join(format!("{stem}.{ext}"));
    let mut index = 2;
    while candidate.exists() {
        candidate = dir.join(format!("{stem}-v{index}.{ext}"));
        index += 1;
    }
    candidate
}
