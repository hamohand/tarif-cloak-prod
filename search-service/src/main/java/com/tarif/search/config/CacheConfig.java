package com.tarif.search.config;

import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarif.search.model.Position;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.cache.RedisCacheManagerBuilderCustomizer;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Configuration du cache Redis pour les résultats de recherche IA.
 * Utilise un sérialiseur Jackson typé explicitement et un gestionnaire d'erreurs
 * tolérant aux pannes (bascule silencieuse sans bloquer les recherches si Redis est indisponible).
 */
@Configuration
@Slf4j
public class CacheConfig implements CachingConfigurer {

    public static final String AI_SEARCH_RESULTS_CACHE = "aiSearchResults";

    @Bean
    public RedisCacheManagerBuilderCustomizer redisCacheManagerBuilderCustomizer() {
        ObjectMapper mapper = new ObjectMapper();
        JavaType positionListType = mapper.getTypeFactory().constructCollectionType(ArrayList.class, Position.class);
        Jackson2JsonRedisSerializer<List<Position>> positionListSerializer =
                new Jackson2JsonRedisSerializer<>(mapper, positionListType);

        RedisCacheConfiguration searchCacheConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofHours(24))
                .disableCachingNullValues()
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(positionListSerializer));

        return builder -> builder.withCacheConfiguration(AI_SEARCH_RESULTS_CACHE, searchCacheConfig);
    }

    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Erreur lecture cache '{}' (clé={}): {} — exécution sans cache",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                log.warn("Erreur écriture cache '{}' (clé={}): {} — ignorée",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Erreur éviction cache '{}' (clé={}): {}",
                        cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                log.warn("Erreur vidage cache '{}': {}", cache.getName(), exception.getMessage());
            }
        };
    }
}
