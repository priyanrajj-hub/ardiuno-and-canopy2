from datetime import datetime, timedelta, timezone
import numpy as np
import requests
import planetary_computer as pc
import stackstac
from pystac_client import Client
import argparse
import json

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"

def latest_ndvi(lat, lon, half_size_deg=0.005, max_cloud=40, days_back=30):
    """Real NDVI for a small box around (lat, lon) from the newest usable Sentinel-2 scene."""
    bbox = [lon - half_size_deg, lat - half_size_deg, lon + half_size_deg, lat + half_size_deg]
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days_back)

    catalog = Client.open(STAC, modifier=pc.sign_inplace)
    items = list(catalog.search(
        collections=["sentinel-2-l2a"],
        bbox=bbox,
        datetime=f"{start:%Y-%m-%d}/{end:%Y-%m-%d}",
        query={"eo:cloud_cover": {"lt": max_cloud}},
    ).items())
    if not items:
        return {"source": "none", "error": "No usable scene in window"}

    item = max(items, key=lambda i: i.datetime)
    data = stackstac.stack(
        [item.to_dict()], assets=["B04", "B08", "SCL"],
        bounds_latlon=bbox, resolution=10, epsg=32644,  # UTM 44N covers Tamil Nadu
    ).squeeze().compute()

    red = data.sel(band="B04").values.astype("float32")
    nir = data.sel(band="B08").values.astype("float32")
    scl = data.sel(band="SCL").values
    # SCL: keep vegetation(4), bare soil(5); drop cloud/shadow/water etc.
    valid = np.isin(scl, [4, 5])
    ndvi = (nir - red) / (nir + red + 1e-6)
    ndvi = ndvi[valid]
    if ndvi.size == 0:
        return {"source": "sentinel-2", "error": "All pixels masked by clouds"}

    age_days = (end - item.datetime).days
    return {
        "source": "Sentinel-2 L2A (real)",
        "scene_date": item.datetime.date().isoformat(),
        "data_age_days": age_days,
        "cloud_cover_pct": item.properties["eo:cloud_cover"],
        "ndvi_mean": round(float(np.nanmean(ndvi)), 3),
        "valid_pixels": int(ndvi.size),
    }

def live_weather(lat, lon):
    r = requests.get("https://api.open-meteo.com/v1/forecast", params={
        "latitude": lat, "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,precipitation",
        "hourly": "soil_moisture_0_to_1cm", "forecast_days": 1,
        "timezone": "auto",
    }, timeout=15)
    r.raise_for_status()
    j = r.json()
    return {"source": "Open-Meteo (live)", "updated": j["current"]["time"], **j["current"]}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--lat", type=float, required=True)
    parser.add_argument("--lon", type=float, required=True)
    args = parser.parse_args()

    try:
        ndvi_res = latest_ndvi(args.lat, args.lon)
        weather_res = live_weather(args.lat, args.lon)
        print(json.dumps({
            "status": "SUCCESS",
            "metrics": {
                "ndvi": ndvi_res,
                "weather": weather_res
            }
        }))
    except Exception as e:
        print(json.dumps({
            "status": "ERROR",
            "error": str(e)
        }))
