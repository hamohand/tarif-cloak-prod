package com.tarif.search.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
public class RestTemplateFactory {

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5000);   // 5 secondes de timeout pour se connecter
        requestFactory.setReadTimeout(90000);     // 90 secondes de timeout pour la lecture (L'IA peut être lente)
        return new RestTemplate(requestFactory);
    }
}
