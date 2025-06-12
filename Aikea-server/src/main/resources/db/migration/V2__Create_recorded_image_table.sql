CREATE TABLE IF NOT EXISTS recorded_image (
    id INT NOT NULL AUTO_INCREMENT,
    cloud_uri VARCHAR(500),
    cloud_id VARCHAR(255),
    image_name VARCHAR(255),
    prompt TEXT,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

