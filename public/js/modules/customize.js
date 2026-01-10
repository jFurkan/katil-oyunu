// Customize Module  
// Character customization system with color selection

export const CUSTOMIZE = {

            selectedColor: '#3b82f6',

            init: function() {
                this.selectColor(this.selectedColor);
            },

            selectColor: function(color) {
                this.selectedColor = color;

                // TÃ¼m renk seÃ§eneklerini gÃ¼ncelle
                var options = document.querySelectorAll('.color-option');
                options.forEach(function(opt) {
                    opt.classList.remove('selected');
                    if (opt.getAttribute('data-color') === color) {
                        opt.classList.add('selected');
                    }
                });
            }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.CUSTOMIZE = CUSTOMIZE;
}
