// Applies the saved FindBox theme before the page paints, so there is no flash. Dark is the default.
try { if (localStorage.getItem('fb-theme') === 'light') { document.documentElement.dataset.theme = 'light'; var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', '#f5f6f0') } } catch (e) {}
