-- canopy-production/src/lib/schema.sql

-- Schema defining the empirical logging of location queries necessary for the location-specific Anomaly Tracking model.

CREATE TABLE IF NOT EXISTS location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Geographical bounding for matching recurring overlapping queries
    center_lat FLOAT NOT NULL,
    center_lng FLOAT NOT NULL,
    polygon_geo JSONB NOT NULL,
    
    -- Absolute GEE Feature Array. 
    -- Nullable because explicit real-world failure states are recorded rather than simulated.
    ndvi_mean FLOAT,
    evi_mean FLOAT,
    lst_temp FLOAT,
    precipitation_mm FLOAT,
    soil_moisture_pct FLOAT,
    
    -- Structural dataset telemetry tags for UI display
    elevation_m FLOAT,
    land_cover_class VARCHAR(100),
    live_weather_temp FLOAT,
    
    -- The core mathematical integrity gate
    is_data_complete BOOLEAN NOT NULL DEFAULT FALSE,
    extraction_source VARCHAR(100) NOT NULL DEFAULT 'GEE_LIVE_PULL',
    
    query_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing by spatial proximity so we can cluster queries to trigger the 20+ row 'Anomaly Output' threshold
CREATE INDEX idx_location_cluster ON location_history(center_lat, center_lng);

-- Tracking the location-specific models generated over time
CREATE TABLE IF NOT EXISTS local_anomaly_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Target cluster bounds
    center_lat FLOAT NOT NULL,
    center_lng FLOAT NOT NULL,
    radius_km FLOAT DEFAULT 1.0,
    
    -- Strict retraining gates proven to the UI
    training_row_count INTEGER NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    last_trained_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Serialized structural anomaly payload (e.g. Prophet/STL seasonality coefficients)
    model_payload JSONB NOT NULL
);
