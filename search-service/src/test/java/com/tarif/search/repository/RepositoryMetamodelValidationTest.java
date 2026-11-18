package com.tarif.search.repository;

import com.tarif.search.model.Chapitre;
import com.tarif.search.model.Position10Dz;
import com.tarif.search.model.Position4;
import com.tarif.search.model.Position6Dz;
import com.tarif.search.model.Section;
import com.tarif.search.model.TariffPosition;
import com.tarif.search.service.ai.batch.AnthropicBatchProvider;
import com.tarif.search.service.ai.batch.BatchService;
import com.tarif.search.service.ai.batch.OpenAiBatchProvider;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;

class RepositoryMetamodelValidationTest {

    @Test
    void allJpaRepositoriesAndHqlQueriesValidateAgainstEntities() {
        Configuration cfg = new Configuration();
        cfg.setProperty("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect");
        cfg.setProperty("hibernate.boot.allow_jdbc_metadata_access", "false");
        cfg.setProperty("jakarta.persistence.schema-generation.database.action", "none");

        cfg.addAnnotatedClass(Section.class);
        cfg.addAnnotatedClass(Chapitre.class);
        cfg.addAnnotatedClass(Position4.class);
        cfg.addAnnotatedClass(Position6Dz.class);
        cfg.addAnnotatedClass(Position10Dz.class);
        cfg.addAnnotatedClass(TariffPosition.class);

        SessionFactory emf = cfg.buildSessionFactory();
        EntityManager em = emf.createEntityManager();
        try {
            JpaRepositoryFactory factory = new JpaRepositoryFactory(em);

            assertNotNull(factory.getRepository(SectionRepository.class));
            assertNotNull(factory.getRepository(ChapitreRepository.class));
            assertNotNull(factory.getRepository(Position4Repository.class));
            assertNotNull(factory.getRepository(Position6DzRepository.class));
            assertNotNull(factory.getRepository(Position10DzRepository.class));
            assertNotNull(factory.getRepository(TariffPositionRepository.class));
        } finally {
            em.close();
            emf.close();
        }
    }

    @Test
    void batchServiceDoesNotFailAtStartupWithOllamaProvider() {
        BatchService batchService = assertDoesNotThrow(() -> new BatchService(
                mock(AnthropicBatchProvider.class),
                mock(OpenAiBatchProvider.class),
                "ollama"
        ));
        assertEquals("ollama", batchService.getActiveProviderName());
    }
}
