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

## Application architecture

- Use separate TanStack content routes inside a shared application shell for each management area, so navigation remains type-safe and each page has independent metadata.
- Keep demonstration data and client-side analytical helpers in a shared browser-safe module; clearly distinguish prototype estimates from a trained model.
- Render geographic visuals from the bundled simplified Brazil state geometry, so the prototype map does not depend on external map services.
