package com.ynov.Aikea.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Getter
@Setter
@ToString
@Table(name = "recorded_image")
public class RecordedImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(name = "cloud_uri")
    private String cloudURI;

    @Column(name = "cloud_id")
    private String cloudID;

    @Column(name = "image_name")
    private String imageName;

    @Column(name = "prompt")
    private String prompt;
}
