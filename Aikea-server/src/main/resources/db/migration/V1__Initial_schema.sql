create table IF NOT exists roles(
    id INT not null auto_increment,
    name varchar(255),
primary key (id)) engine=InnoDB;

create table IF NOT exists users (
    id INT not null auto_increment,
    username varchar(100),
    password VARCHAR(100) NOT NULL,
    enabled boolean,
primary key (id)) engine=InnoDB;

# On Utilise toujours des liste de roles, pour permettre lajout de nouveaux roles a un utilisateur
CREATE TABLE IF NOT exists users_roles (
    users_id INT,
    roles_id INT,
    FOREIGN KEY (users_id) REFERENCES users(id),
    FOREIGN KEY (roles_id) REFERENCES roles(id),
    PRIMARY KEY (users_id, roles_id)
);

# Le nom des roles doit commencer par ROLE_ en spring security
INSERT INTO roles (name) VALUES
('ROLE_ADMIN');

# Ajout dun compte administrateur avec mot de passe haché BCrypt pour "admin123"
INSERT INTO users (username, password, enabled) VALUES
('admin', '$2a$10$OERIj4nIwx.Z/Yi9BxPJ1.yaJu6VUn5SBxeLWN1aXQg6uctbVsDhm', true);

# Attribution du rôle ADMIN à l'utilisateur 'admin'
INSERT INTO users_roles (users_id, roles_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.username = 'admin' AND r.name = 'ROLE_ADMIN';
