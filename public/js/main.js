// Bootstrap: theme/motion, content load, header, routes, router, skip link.
import { h, clear } from './lib/dom.js';
import { initTheme } from './lib/theme.js';
import { initMotion } from './lib/motion.js';
import { normalizeContent } from './lib/normalize.js';
import { loadContent } from './content-loader.js';
import { createRouter } from './router.js';
import { renderHeader } from './components/header.js';
import { closeLightbox } from './components/lightbox.js';
import * as home from './views/home.js';
import * as projects from './views/projects.js';
import * as art from './views/art.js';
import * as music from './views/music.js';
import * as pictures from './views/pictures.js';
import * as about from './views/about.js';
import * as contact from './views/contact.js';

const VIEWS = { home, projects, art, music, pictures, about, contact };

document.documentElement.classList.add('js');
initTheme();
initMotion();

const main = document.getElementById('main');
const headerEl = document.getElementById('site-header');

function wireSkipLink() {
  const skip = document.querySelector('.skip-link');
  if (!skip) return;
  skip.addEventListener('click', (e) => {
    e.preventDefault();
    main.focus();
  });
}

function renderError(err) {
  const isFile = err && err.code === 'FILE_PROTOCOL';
  clear(main);
  main.removeAttribute('aria-busy');
  const retry = h('button', { type: 'button', class: 'btn btn-primary' }, 'Retry');
  retry.addEventListener('click', () => {
    clear(main);
    main.append(h('p', { role: 'status', class: 'loading' }, 'Loading…'));
    bootstrap();
  });
  const title = h('h1', { tabindex: '-1', class: 'view-title' }, 'Couldn’t load the site');
  main.append(h('div', { class: 'view-inner' },
    h('div', { class: 'card error-card', role: 'alert' },
      title,
      h('p', null, isFile
        ? 'This site uses JavaScript modules, which browsers block when a page is opened straight from disk (file://). Run "npm start" in the project folder, or serve the public/ folder with any static server, then open the printed address.'
        : 'The content file could not be loaded. Check your connection and try again.'),
      retry)));
}

async function bootstrap() {
  main.setAttribute('aria-busy', 'true');
  let loaded;
  try {
    loaded = await loadContent();
  } catch (err) {
    console.error(err);
    renderError(err);
    return;
  }

  const content = normalizeContent(loaded.content);
  const ctx = { apiAvailable: loaded.source === 'api' };

  initTheme(content.site.themeDefault);
  document.documentElement.lang = content.site.lang;
  document.title = content.site.title;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && content.site.description) metaDesc.setAttribute('content', content.site.description);

  const header = renderHeader(content, {
    onNavigate: (id) => {
      header.closeMenu();
      router.navigate(id);
    },
  });
  headerEl.replaceChildren(header.element);

  const routes = new Map(content.nav.map((n) => [n.id, {
    label: n.label,
    render: () => VIEWS[n.id].render(content, ctx),
  }]));

  clear(main);
  main.removeAttribute('aria-busy');
  const router = createRouter({
    routes,
    defaultRoute: content.nav[0].id,
    container: main,
    siteTitle: content.site.title,
    beforeRoute: () => closeLightbox(),
    onRoute: () => header.closeMenu(),
  });
  router.start();
  document.documentElement.classList.add('is-ready');
}

wireSkipLink();
bootstrap();
