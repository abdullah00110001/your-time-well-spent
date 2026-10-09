# Architecture rules

- Keep the landing story's scroll progress in refs and reuse the existing hero Canvas; this avoids scroll-driven React renders and duplicate WebGL contexts.
- Suspend landing animation when offscreen or the document is hidden; this preserves resources on low-end devices.