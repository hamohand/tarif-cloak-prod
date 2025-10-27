package com.muhend.backend.auth.repository;

import com.muhend.backend.auth.models.User;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends CrudRepository<User, String> {
    // Search for a user by email
    User findByEmail(String email);

    // Search for a user by username
    User findByUsername(String username);

}
