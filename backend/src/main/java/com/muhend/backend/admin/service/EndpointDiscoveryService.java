package com.muhend.backend.admin.service;

import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.*;

import java.lang.reflect.Method;
import java.util.*;

@Service
public class EndpointDiscoveryService {

    private final ApplicationContext applicationContext;

    public EndpointDiscoveryService(ApplicationContext applicationContext) {
        this.applicationContext = applicationContext;
    }

    public List<Map<String, Object>> discoverEndpoints() {
        List<Map<String, Object>> endpoints = new ArrayList<>();
        
        // Récupérer tous les beans de type @RestController
        Map<String, Object> controllers = applicationContext.getBeansWithAnnotation(RestController.class);
        
        for (Object controller : controllers.values()) {
            Class<?> controllerClass = controller.getClass();
            
            // Récupérer le @RequestMapping au niveau de la classe
            RequestMapping classMapping = controllerClass.getAnnotation(RequestMapping.class);
            String basePath = classMapping != null && classMapping.value().length > 0 
                ? classMapping.value()[0] 
                : "";
            
            // Parcourir toutes les méthodes du contrôleur
            for (Method method : controllerClass.getDeclaredMethods()) {
                Map<String, Object> endpointInfo = extractEndpointInfo(method, basePath, controllerClass);
                if (endpointInfo != null) {
                    endpoints.add(endpointInfo);
                }
            }
        }
        
        // Trier par path
        endpoints.sort(Comparator.comparing(e -> (String) e.get("path")));
        
        return endpoints;
    }

    private Map<String, Object> extractEndpointInfo(Method method, String basePath, Class<?> controllerClass) {
        Map<String, Object> info = new HashMap<>();
        
        // Vérifier les annotations de mapping HTTP
        GetMapping getMapping = method.getAnnotation(GetMapping.class);
        PostMapping postMapping = method.getAnnotation(PostMapping.class);
        PutMapping putMapping = method.getAnnotation(PutMapping.class);
        DeleteMapping deleteMapping = method.getAnnotation(DeleteMapping.class);
        PatchMapping patchMapping = method.getAnnotation(PatchMapping.class);
        RequestMapping requestMapping = method.getAnnotation(RequestMapping.class);
        
        String httpMethod = null;
        String[] paths = null;
        
        if (getMapping != null) {
            httpMethod = "GET";
            paths = getMapping.value().length > 0 ? getMapping.value() : getMapping.path();
        } else if (postMapping != null) {
            httpMethod = "POST";
            paths = postMapping.value().length > 0 ? postMapping.value() : postMapping.path();
        } else if (putMapping != null) {
            httpMethod = "PUT";
            paths = putMapping.value().length > 0 ? putMapping.value() : putMapping.path();
        } else if (deleteMapping != null) {
            httpMethod = "DELETE";
            paths = deleteMapping.value().length > 0 ? deleteMapping.value() : deleteMapping.path();
        } else if (patchMapping != null) {
            httpMethod = "PATCH";
            paths = patchMapping.value().length > 0 ? patchMapping.value() : patchMapping.path();
        } else if (requestMapping != null) {
            httpMethod = requestMapping.method().length > 0 
                ? requestMapping.method()[0].name() 
                : "GET";
            paths = requestMapping.value().length > 0 ? requestMapping.value() : requestMapping.path();
        }
        
        // Si aucune annotation de mapping trouvée, ignorer cette méthode
        if (httpMethod == null) {
            return null;
        }
        
        // Construire le chemin complet
        String methodPath = paths != null && paths.length > 0 ? paths[0] : "";
        String fullPath = basePath + methodPath;
        if (!fullPath.startsWith("/")) {
            fullPath = "/" + fullPath;
        }
        
        info.put("method", httpMethod);
        info.put("path", fullPath);
        info.put("controller", controllerClass.getSimpleName());
        info.put("methodName", method.getName());
        
        // Extraire les paramètres
        List<Map<String, String>> parameters = new ArrayList<>();
        for (java.lang.reflect.Parameter param : method.getParameters()) {
            Map<String, String> paramInfo = new HashMap<>();
            paramInfo.put("name", param.getName());
            paramInfo.put("type", param.getType().getSimpleName());
            
            // Vérifier les annotations de paramètre
            if (param.getAnnotation(RequestParam.class) != null) {
                RequestParam requestParam = param.getAnnotation(RequestParam.class);
                paramInfo.put("source", "query");
                paramInfo.put("required", String.valueOf(requestParam.required()));
                if (!requestParam.value().isEmpty()) {
                    paramInfo.put("paramName", requestParam.value());
                }
            } else if (param.getAnnotation(PathVariable.class) != null) {
                PathVariable pathVariable = param.getAnnotation(PathVariable.class);
                paramInfo.put("source", "path");
                if (!pathVariable.value().isEmpty()) {
                    paramInfo.put("paramName", pathVariable.value());
                }
            } else if (param.getAnnotation(RequestBody.class) != null) {
                paramInfo.put("source", "body");
            }
            
            parameters.add(paramInfo);
        }
        info.put("parameters", parameters);
        
        // Extraire le type de retour
        info.put("returnType", method.getReturnType().getSimpleName());
        
        // Vérifier les annotations de sécurité
        if (method.getAnnotation(org.springframework.security.access.prepost.PreAuthorize.class) != null) {
            org.springframework.security.access.prepost.PreAuthorize preAuthorize = 
                method.getAnnotation(org.springframework.security.access.prepost.PreAuthorize.class);
            info.put("requiredRole", preAuthorize.value());
        }
        
        return info;
    }
}

