# Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "Codex CLI not detected" | Not installed or not on PATH | `npm install -g @openai/codex`, press *Re-check*, or set an explicit path in Model Settings |
| Login window never finishes | Browser flow blocked | Use *Device auth* and complete the code on another device |
| `not_authenticated` on generate | Profile missing or session expired | Authentication → *Verify*; re-import `auth.json` or sign in again |
| "Engine produced no image" | Prompt rejected, or `generated_images` convention changed | Read the run log; run Diagnostics; confirm the skill is installed |
| Job stuck in `running` | App closed mid-run | Restart: interrupted jobs are recovered and marked for retry |
| Cancel does nothing | Process tree still finishing | Cancel sends `taskkill /T /F`; wait a few seconds then retry |
| Images missing in the grid | Asset protocol scope or file moved | Preferences → open data root and verify the file exists; re-import via Gallery if needed |
| Persian text renders LTR | Direction preference | Preferences → Direction: right-to-left; language fa |
| Thumbnails blank | File was deleted outside ARIA | Refresh the gallery; ARIA regenerates thumbnails on demand |
| "Rate limited" errors | Codex account limits | Wait, lower `max_concurrent_jobs`, retry from History |
| Installer blocked by SmartScreen | Unsigned binary | *More info → Run anyway*; signing is planned post-1.0 |
| App shows "Desktop runtime required" | Opened in a browser, not the app | Launch the installed app or `npm run tauri dev` |

## Collecting a report

Diagnostics → *Export report* writes a redacted JSON + Markdown pair into `Exports/`. The bundle contains versions,
paths, check results and the registry summary — never tokens or prompts.
