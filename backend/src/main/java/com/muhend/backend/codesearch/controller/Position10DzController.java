package com.muhend.backend.codesearch.controller;

import com.muhend.backend.codesearch.model.Position10Dz;
import com.muhend.backend.codesearch.repository.Position10DzRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/positions10dz")
public class Position10DzController {

    private final Position10DzRepository position10DzRepository;

    public Position10DzController(Position10DzRepository position10DzRepository) {
        this.position10DzRepository = position10DzRepository;
    }

    @GetMapping
    public List<Position10Dz> getAllPositions() {
        return position10DzRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Position10Dz> getPositionById(@PathVariable Long id) {
        Optional<Position10Dz> position = position10DzRepository.findById(id);
        return position.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/code/{code}")
    public ResponseEntity<Position10Dz> getPositionByCode(@PathVariable String code) {
        Optional<Position10Dz> position = position10DzRepository.findByCode(code);
        return position.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Position10Dz> createPosition(@RequestBody Position10Dz position) {
        Position10Dz saved = position10DzRepository.save(position);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Position10Dz> updatePosition(@PathVariable Long id, @RequestBody Position10Dz positionDetails) {
        return position10DzRepository.findById(id)
                .map(existing -> {
                    existing.setCode(positionDetails.getCode());
                    existing.setDescription(positionDetails.getDescription());
                    return ResponseEntity.ok(position10DzRepository.save(existing));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePosition(@PathVariable Long id) {
        return position10DzRepository.findById(id)
                .map(position -> {
                    position10DzRepository.delete(position);
                    return new ResponseEntity<Void>(HttpStatus.NO_CONTENT);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
