CREATE TABLE IF NOT EXISTS roles(
                                    id INT NOT NULL AUTO_INCREMENT,
                                    name VARCHAR(255),
    PRIMARY KEY (id)
    ) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
                                     id INT NOT NULL AUTO_INCREMENT,
                                     username VARCHAR(100),
    password VARCHAR(100) NOT NULL,
    enabled BOOLEAN,
    token_expiration DATETIME,  /* Ajout de la colonne pour LocalDateTime tokenExpiration */
    claim_token VARCHAR(255),   /* Ajout de la colonne pour String claimToken */
    PRIMARY KEY (id)
    ) ENGINE=InnoDB;

# On utilise toujours des liste de roles, pour permettre l'ajout de nouveaux roles a un utilisateur
CREATE TABLE IF NOT EXISTS users_roles (
    users_id INT,
    roles_id INT,
    FOREIGN KEY (users_id) REFERENCES users(id),
    FOREIGN KEY (roles_id) REFERENCES roles(id),
    PRIMARY KEY (users_id, roles_id)
);

# Le nom des roles doit commencer par ROLE_ en spring security
INSERT INTO roles (name) VALUES
('ROLE_ADMIN');

# Ajout d'un compte administrateur avec mot de passe haché BCrypt pour "admin123"
INSERT INTO users (username, password, enabled) VALUES
('admin', '$2a$10$nUCOAOvFsm03LZaFZnTOdunkiDkLYCoNPn25fDRJCHHE8AD52Y3Oq', true);

# Attribution du rôle ADMIN à l'utilisateur 'admin'
INSERT INTO users_roles (users_id, roles_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.username = 'admin' AND r.name = 'ROLE_ADMIN';
