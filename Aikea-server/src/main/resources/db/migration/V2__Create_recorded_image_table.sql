CREATE TABLE recorded_image (
                                id INT AUTO_INCREMENT PRIMARY KEY,
                                cloud_uri VARCHAR(1024),
                                cloud_id VARCHAR(255),
                                image_name VARCHAR(255),
                                prompt TEXT
);