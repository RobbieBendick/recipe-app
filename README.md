# Recipe App

SvelteKit frontend for recipes + shopping lists.

Uses the Go API at [recipe-app-backend-bay.vercel.app](https://recipe-app-backend-bay.vercel.app/).

## Develop

```sh
cp .env.example .env
npm install
npm run dev
```

`PUBLIC_API_URL` points at the deployed backend by default.

## Deploy to GitHub Pages

```sh
npm run deploy:gh-pages
```

Site: `https://robbiebendick.github.io/recipe-app/`

In the GitHub repo: **Settings → Pages → Deploy from branch → `gh-pages` / root**.

Add that URL as an authorized JavaScript origin (and redirect URI if needed) on your Google OAuth client.
