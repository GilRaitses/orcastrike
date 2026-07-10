# Slice clip provenance (the one real audio artifact for the BSW demo slice)

`orcasound_lab_20210825_srkw.m4a` is REAL measured hydrophone audio. It is
gitignored (heavy asset, box-bound) and re-fetched by the BAM pipeline.

| Field | Value |
|-------|-------|
| Station | Orcasound Lab (Haro Strait, west San Juan Island) |
| Node | `rpi_orcasound_lab` |
| Coords | 48.5583362, -123.1735774 |
| Source bucket | `s3://audio-orcasound-net/rpi_orcasound_lab/hls/1629941419/` |
| HLS session | `1629941419` (2021-08-25 18:30:19 PDT folder) |
| Bout | `210825_1922-2007_OS_SRKW_L` (S10 L-pod SRKW calls) |
| Demo window | segments live339-live356 (~19:26:56-19:29:41 PDT) |
| Decode | AAC-in-MPEG-TS -> 48 kHz mono PCM -> AAC 96 kbps mono m4a |
| Duration | ~180 s |
| License | CC BY-NC-SA 4.0 (NonCommercial use authorized, SIGN_OFF.md decision 1) |
| Attribution | "Orcasound - orcasound.net" |
| Honesty | measured |

## Re-fetch

```
python3 modeling/acoustic/fetch_orcasound_clip.py
ffmpeg -y -i infra/acoustic/data/wav/demo_window.wav -ac 1 -ar 48000 \
  -c:a aac -b:a 96k web/public/hydrophone/slice/orcasound_lab_20210825_srkw.m4a
```

Blog narrative: https://www.orcasound.net/2021/08/25/exciting-s10-l-pod-calls-as-the-sun-sets-over-orcasound-lab/
Timing caveat (Orcasound): align playhead to audio content (calls visible in
the spectrogram), not wall-clock, due to possible ~10 min HLS segment drift.
