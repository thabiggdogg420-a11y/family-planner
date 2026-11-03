# Source baseline

This is a clean contributor export of Family Planner / Farewell Together public version 53. It retains browser source and focused regression tests, with fresh contributor documentation and a portable build script. The export does not include private deployment configuration, production data, private review notes or generated historical builds.

Packaging changes: the Worker builder uses a filesystem-safe URL conversion and writes schema source under `dist/migrations/` without requiring hosting account metadata. This repository does not deploy automatically. A static preview does not provide the usage API; its absence does not prevent core browser practice/planning.
