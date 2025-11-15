<#import "template.ftl" as layout>
<@layout.registrationLayout; section>
    <#if section = "header">
        <div class="custom-header">
            <h1>Bienvenue sur Enclume-Numérique</h1>
            <p>Connectez-vous à votre compte</p>
        </div>
        <script src="${url.resourcesPath}/js/password-toggle.js"></script>
    <#elseif section = "form">
        <div class="custom-login-container">
            <form id="kc-form-login" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
                <div class="form-group">
                    <label for="username" class="custom-label">
                        <#if !realm.loginWithEmailAllowed>
                            Nom d'utilisateur
                        <#elseif !realm.registrationEmailAsUsername>
                            Nom d'utilisateur ou email
                        <#else>
                            Email
                        </#if>
                    </label>
                    <input tabindex="1" id="username" class="custom-input" name="username" 
                           value="${(login.username!'')}" type="text" autofocus autocomplete="off"
                           aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                           placeholder="Entrez votre nom d'utilisateur ou email" />
                </div>

                <div class="form-group">
                    <label for="password" class="custom-label">Mot de passe</label>
                    <div class="password-input-wrapper">
                        <input tabindex="2" id="password" class="custom-input password-input" name="password" type="password" autocomplete="off"
                               aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                               placeholder="Entrez votre mot de passe" />
                        <button type="button" class="password-toggle" id="password-toggle" aria-label="Afficher le mot de passe">
                            <span class="password-toggle-icon">👁️</span>
                        </button>
                    </div>
                </div>

                <div class="form-options">
                    <#if realm.rememberMe && !usernameHidden??>
                        <div class="checkbox">
                            <label>
                                <#if login.rememberMe??>
                                    <input tabindex="3" id="rememberMe" name="rememberMe" type="checkbox" checked> Se souvenir de moi
                                <#else>
                                    <input tabindex="3" id="rememberMe" name="rememberMe" type="checkbox"> Se souvenir de moi
                                </#if>
                            </label>
                        </div>
                    </#if>
                    <div class="forgot-password">
                        <#if realm.resetPasswordAllowed>
                            <span><a tabindex="5" href="${url.loginResetCredentialsUrl}">Mot de passe oublié ?</a></span>
                        </#if>
                    </div>
                </div>

                <div id="kc-form-buttons" class="form-buttons">
                    <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                    <input tabindex="4" class="custom-button primary" name="login" id="kc-login" type="submit" value="Se connecter"/>
                </div>
            </form>
        </div>
    </#if>
</@layout.registrationLayout>

