// Script pour le toggle du mot de passe
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.getElementById('password-toggle');
    
    if (passwordInput && passwordToggle) {
        passwordToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Changer l'icône
            const icon = passwordToggle.querySelector('.password-toggle-icon');
            if (type === 'text') {
                icon.textContent = '🙈';
                passwordToggle.classList.add('active');
                passwordToggle.setAttribute('aria-label', 'Masquer le mot de passe');
            } else {
                icon.textContent = '👁️';
                passwordToggle.classList.remove('active');
                passwordToggle.setAttribute('aria-label', 'Afficher le mot de passe');
            }
        });
    }
});

