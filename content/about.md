# À propos de ce pipeline

## Source des données

Les données de qualité de l'air proviennent de l'API OpenWeather Air
Pollution, interrogée pour 9 villes : Paris, Madrid, Buenos Aires, Londres,
et cinq villes de Madagascar (Antananarivo, Toamasina, Antsirabe, Mahajanga,
Fianarantsoa).

## Orchestration

Un workflow GitHub Actions s'exécute toutes les heures (cron) pour appeler
l'API, transformer les résultats et les charger dans l'entrepôt de données.

## Modélisation

Les données sont modélisées en schéma en étoile :

- `dim_city` — dimension ville (nom, pays, coordonnées)
- `dim_time` — dimension temporelle (horodatage, date, heure, jour de la
  semaine, week-end)
- `fact_aqi` — table de faits (AQI, PM2.5, PM10, NO2, O3), une ligne par
  ville et par heure

## Entrepôt

L'entrepôt est hébergé sur Neon, un service Postgres serverless. Ce
tableau de bord se connecte via un rôle **lecture seule** dédié — aucune
requête émise par l'application ne peut modifier les données.
