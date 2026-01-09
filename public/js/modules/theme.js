// Theme Management Module
export const THEME = {
    // GÜVENLİK: sessionStorage kullan (localStorage yerine) - oturum sonu temizlensin
    current: sessionStorage.getItem('theme') || 'classic',

    init() {
        this.applyTheme(this.current);
        this.updateActiveOption(this.current);
    },

    setTheme(theme) {
        this.current = theme;
        sessionStorage.setItem('theme', theme);
        this.applyTheme(theme);
        this.updateActiveOption(theme);
        this.closeMenu();
    },

    applyTheme(theme) {
        if (theme === 'classic') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    },

    updateActiveOption(theme) {
        document.querySelectorAll('.theme-option').forEach(opt => {
            opt.classList.remove('active');
        });
        const activeOption = document.querySelector(`.theme-option[data-theme="${theme}"]`);
        if (activeOption) {
            activeOption.classList.add('active');
        }
    },

    toggleMenu() {
        const menu = document.getElementById('themeMenu');
        if (menu) {
            menu.classList.toggle('active');
        }
    },

    closeMenu() {
        const menu = document.getElementById('themeMenu');
        if (menu) {
            menu.classList.remove('active');
        }
    }
};

// Make THEME globally accessible for inline onclick handlers
if (typeof window !== 'undefined') {
    window.THEME = THEME;
}
