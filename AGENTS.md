<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Finance maths lives only in src/lib/finance as pure functions; project() and monteCarlo() both use engine.simulatePath so they always agree.
- Currency conversion goes through fx.convert with USD-based rates (fx_rates table + profile.fx_overrides); a missing rate converts to 0 and is warned, never guessed.
- Money columns stay Postgres `numeric` (exact decimals); money.ts handles minor units and outputs are rounded with roundMoney.
