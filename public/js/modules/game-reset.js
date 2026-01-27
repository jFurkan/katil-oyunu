// Game Reset Module
// Game reset functionality with confirmation

// Get global functions

export const GAME_RESET = {
    showConfirmModal: function() {
        const modal = document.getElementById('resetConfirmModal');
        const input = document.getElementById('resetConfirmInput');

        // Input'u temizle
        input.value = '';

        // Modal'ı göster (flex olarak)
        modal.style.display = 'flex';

        // Input'a focus
        setTimeout(function() {
            input.focus();
        }, 100);
    },

    hideConfirmModal: function() {
        const modal = document.getElementById('resetConfirmModal');
        modal.style.display = 'none';
    },

    confirmReset: function() {
        const socket = window.socket;
        const toast = window.toast;
        const input = document.getElementById('resetConfirmInput');
        const confirmText = input.value.trim().toUpperCase();

        if (confirmText !== 'SIFIRLA') {
            window.toast('Onaylamak için "SIFIRLA" yazmalısınız!', true);
            input.focus();
            return;
        }

        // Confirmation geçti, server'a istek gönder
        window.toast('Oyun sıfırlanıyor, lütfen bekleyin...');

        window.safeSocketEmit('reset-game', function(response) {
            if (response && response.success) {
                GAME_RESET.hideConfirmModal();
                window.toast('✅ Oyun başarıyla sıfırlandı! Sayfa yenileniyor...');

                // 2 saniye sonra sayfayı yenile
                setTimeout(function() {
                    window.location.reload();
                }, 2000);
            } else {
                window.toast(response.error || 'Sıfırlama başarısız!', true);
            }
        });
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.GAME_RESET = GAME_RESET;
}
