Original prompt: einmal bitte pushen und pair erstellen, und danach force push auf main. Wenn das Mini Game noch nicht implementiert ist, dann implementier das jetzt. Mach keine Feder.

- Scope: project README and a visible Desert Strikes / Dark Drops modal minigame.
- The issue #2 worker implementation is preserved in Git stash 7dea4c798560795d07cdbdc368b24439172828ac.
- Game: dodge falling drops, three lives, survive 30 seconds; keyboard and touch controls, pause, replay and fullscreen.
- Implemented: pure seeded simulation, canvas desert artwork, native modal with focus restoration, automatic pause on blur/tab hiding, local best score and deterministic browser QA hooks.
- README now describes the implemented game and its controls; infrastructure and real scraping remain explicitly planned.
- Initial browser run caught native dialog focus resetting to Close under React StrictMode; explicitly focus the Start button after each showModal call.
- Initial build, typecheck and tests passed: 7 backend API tests and 8 game engine tests.
- Browser validation exposed a Tab wrap focus gap after exiting fullscreen; added explicit forward/backward Tab wrapping within the native dialog.
- Validation passed: 8 engine tests, 7 backend tests, typecheck and production build. Browser checks cover keyboard movement/bounds, simultaneous keys, pause/resume, restart, win/loss, score persistence, fullscreen, blur pause, Tab trapping, Escape/close, focus restoration, hook cleanup and touch movement/release at 375px. No console errors.
- Visually inspected landing page, desktop gameplay, mobile gameplay and win state. Adjusted secondary/touch hover colors to preserve text contrast.
- Publishing procedure: push this branch, create the pull request, then update main using an explicit force-with-lease and an ancestry check.
- Next agent: the issue #2 work remains in the stash above; do not apply it to this documentation/game branch. No known game TODOs. Real scraper/persistence/dashboard work belongs to the existing issues.
