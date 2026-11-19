# Security

Report a vulnerability privately through GitHub: **Security → Report a vulnerability** on this repository.
Please do not open a public issue for it.

In scope: the compiler writing outside its output directory, a Creative IR or recipe that makes the compiler
execute code, and unsafe handling of asset paths. HyperStudio runs locally and has no network service.

Rendering runs the compiled HTML in Chrome through HyperFrames. Treat a recipe from someone else as code:
read it before you compile with it. Problems in HyperFrames itself belong to
[its security policy](https://github.com/heygen-com/hyperframes/security).
