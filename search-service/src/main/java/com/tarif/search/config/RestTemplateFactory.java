package com.tarif.search.config;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

public class RestTemplateFactory {
    
    // Instance unique pour réutiliser les connexions et appliquer un timeout global
    private static final RestTemplate INSTANCE;
    
    static {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5000);   // 5 secondes de timeout pour se connecter
        requestFactory.setReadTimeout(90000);     // 90 secondes de timeout pour la lecture (L'IA peut être lente)
        INSTANCE = new RestTemplate(requestFactory);
    }
    
    public static RestTemplate get() {
        return INSTANCE;
    }
}
