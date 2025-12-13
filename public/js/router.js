/**
 * Vanilla JavaScript Router
 * Client-side routing using History API
 */

class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;

        // Browser geri/ileri butonları için
        window.addEventListener('popstate', (e) => {
            this.handleRoute(window.location.pathname);
        });

        // Link tıklamalarını yakalama - delegation pattern
        document.addEventListener('click', (e) => {
            // En yakın [data-link] elementi bul (nested elementler için)
            const link = e.target.closest('[data-link]');
            if (link) {
                e.preventDefault();
                const href = link.getAttribute('href');
                if (href && href !== '#') {
                    this.navigate(href);
                }
            }
        });
    }

    /**
     * Route kaydı
     * @param {string} path - URL pattern (e.g., "/team/:teamId")
     * @param {Function} handler - Route handler fonksiyonu
     */
    register(path, handler) {
        this.routes[path] = handler;
    }

    /**
     * Programatik navigasyon
     * @param {string} path - Hedef URL
     * @param {boolean} addToHistory - History API'ye ekle
     */
    navigate(path, addToHistory = true) {
        if (addToHistory) {
            history.pushState(null, null, path);
        }
        this.handleRoute(path);
    }

    /**
     * Route işleyici - URL'e göre handler çalıştır
     * @param {string} path - İşlenecek URL path
     */
    handleRoute(path) {
        const route = this.matchRoute(path);

        if (route) {
            // Cleanup önceki route
            if (this.currentRoute && this.currentRoute.cleanup) {
                try {
                    this.currentRoute.cleanup();
                } catch (err) {
                    console.error('Route cleanup error:', err);
                }
            }

            // Yeni route'u çalıştır
            try {
                const result = route.handler(route.params);

                // Handler cleanup fonksiyonu dönebilir
                if (result && typeof result.cleanup === 'function') {
                    this.currentRoute = result;
                } else {
                    this.currentRoute = { cleanup: null };
                }
            } catch (err) {
                console.error('Route handler error:', err);
                // Hata durumunda ana sayfaya yönlendir
                this.navigate('/', false);
            }
        } else {
            // 404 - Route bulunamadı
            console.warn('404: Route not found:', path);
            this.navigate('/', false);
        }
    }

    /**
     * URL pattern'ini regex'e çevir ve eşleştir
     * @param {string} path - Kontrol edilecek URL
     * @returns {Object|null} - Match bilgisi veya null
     */
    matchRoute(path) {
        // Önce exact match kontrol et
        if (this.routes[path]) {
            return {
                handler: this.routes[path],
                params: {}
            };
        }

        // Pattern matching (e.g., /team/:teamId)
        for (let pattern in this.routes) {
            const regex = this.pathToRegex(pattern);
            const match = path.match(regex);

            if (match) {
                return {
                    handler: this.routes[pattern],
                    params: this.extractParams(pattern, match)
                };
            }
        }

        return null;
    }

    /**
     * URL pattern'ini regex'e çevir
     * @param {string} path - Pattern (e.g., "/team/:teamId")
     * @returns {RegExp} - Regex pattern
     */
    pathToRegex(path) {
        // :param şeklindeki parametreleri yakalayan regex
        // Örnek: "/team/:teamId" -> /^\/team\/([^/]+)$/
        return new RegExp(
            '^' + path
                .replace(/\//g, '\\/') // Escape slashes
                .replace(/:(\w+)/g, '([^/]+)') // :param -> capture group
                + '$'
        );
    }

    /**
     * URL parametrelerini çıkar
     * @param {string} pattern - URL pattern
     * @param {Array} match - Regex match sonucu
     * @returns {Object} - Parametreler { teamId: "abc123" }
     */
    extractParams(pattern, match) {
        const keys = [];
        const regex = /:(\w+)/g;
        let result;

        // Pattern'deki tüm :param'ları bul
        while ((result = regex.exec(pattern)) !== null) {
            keys.push(result[1]);
        }

        // Match sonuçlarıyla eşleştir
        const params = {};
        keys.forEach((key, i) => {
            params[key] = match[i + 1];
        });

        return params;
    }

    /**
     * İlk yükleme için route'u işle
     * DOMContentLoaded'dan sonra çağırılmalı
     */
    init() {
        this.handleRoute(window.location.pathname);
    }
}

// Global router instance
window.router = new Router();
