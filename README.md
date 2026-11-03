# Plan4Free

[Open Plan4Free](https://plan.free4allhub.com) · [Free4AllHub — all projects](https://free4allhub.com) · Repository name remains `family-planner` for existing links.

Practical browser-based tools for organizing celebrations and planning a farewell: break decisions into manageable steps, prepare handovers, and keep people informed without turning private family details into public content.

The browser source is in `public/`. Use fictional information when developing or filing issues. Local saves, downloaded exports and offline app interfaces are distinct: deleting browser state does not delete a file you previously downloaded.

## Preview the browser interface

With Python 3 installed, from the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory public
```

Open `http://127.0.0.1:8000/`, `/celebrations/` or `/memorial.html`. This is a static UI preview, not the production Worker: extensionless routes and `/api/usage` are not provided by Python's server. Use `?measurement_test=1` for test sessions. No deployment account is needed for the static preview.

## Checks and build source

The export checks below were verified with Node.js 24.22.1 (no dependency installation required):

```sh
node measurement/test.mjs
node measurement/hooks-test.mjs
node measurement/celebrations-hooks-test.mjs
node --test test/*.test.mjs
```

These focused tests cover aggregate event handling and relevant UI hooks, not the whole planning experience. For changes to the memorial app shell, regenerate it with `node scripts/build-memorial-shell.mjs` and review the generated diff.

The existing Worker build is `node scripts/build-measurement.mjs`, followed by `node scripts/validate-measurement.mjs`. It reads `public/`, the measurement endpoint and migrations, then rewrites `dist/`. This source export removes the original hosting-account metadata requirement. Output includes `dist/server/index.js` and schema source in `dist/migrations/`; deployment configuration is deliberately not included. These commands do not deploy the site.

## Project map

- `public/`: interface, local-state models and generated memorial service worker.
- `public/celebrations/`: occasion planning, handovers and venue guidance.
- `measurement/`: bounded aggregate event endpoint and tests; not private plan storage.
- `scripts/`: Worker build/validation and offline-shell generation.
- `drizzle/`: aggregate measurement schema migrations.

## Help wanted

- Test keyboard navigation, readable contrast and narrow-screen planning flows.
- Exercise save/export/import/recovery using fictional plans.
- Document the offline-shell update flow and verify stale-interface recovery.
- Extend regression coverage for the planning interface and offline recovery.

## Limits and rights

These are planning aids, not a substitute for qualified legal, medical or funeral-service advice. Verify local requirements and provider details independently. Venue data has its own attribution in `public/celebrations/data/CITY-OF-SYDNEY-ATTRIBUTION.txt`; preserve it. Original platform code is MIT-licensed; see THIRD-PARTY-NOTICES.md for exclusions. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Offline guest handout

The celebrations planner can prepare an HTML or plain-text guest handout from explicitly reviewed guest fields. It does not send invitations, update previously downloaded files, or include the whole private plan. Re-review after changing the plan. Verify this feature with `node --test test/guest-file.test.mjs`.

## Reviewed occasion workflows (public v53 source)

The source includes change-impact review, a day-of operating desk, selective reusable logistics and selective backup import. Backup import starts with every choice off; matching IDs require explicit replacement review rather than automatic identity matching or merging. Unselected occasions and the saved original are preserved. Imported plans remain session-only with Remember off until separately chosen. These are local planning/transfer tools, not automatic sync, collaboration, supplier bookings or outbound delivery.

The checked-in backup fixtures are synthetic. Run the complete `node --test test/*.test.mjs` suite for preservation, stale/repeat/cancel and malformed-input regressions. These tests are not physical-mobile or human-organiser acceptance.
