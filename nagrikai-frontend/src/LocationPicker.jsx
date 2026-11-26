import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { formatCoordinates } from "./groundtruthService";

function MapClickSelector({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapFlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: true });
    }
  }, [map, lat, lng]);
  return null;
}

export default function LocationPicker({
  isOpen,
  onClose,
  initialLocation,
  gpsLocation,
  onSave,
}) {
  const fallbackLat = Number.isFinite(initialLocation?.lat)
    ? initialLocation.lat
    : Number.isFinite(gpsLocation?.lat)
    ? gpsLocation.lat
    : 28.4744;
  const fallbackLng = Number.isFinite(initialLocation?.lng)
    ? initialLocation.lng
    : Number.isFinite(gpsLocation?.lng)
    ? gpsLocation.lng
    : 77.504;

  const [draftLat, setDraftLat] = useState(fallbackLat);
  const [draftLng, setDraftLng] = useState(fallbackLng);
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraftLat(fallbackLat);
    setDraftLng(fallbackLng);
  }, [isOpen, fallbackLat, fallbackLng]);

  useEffect(() => {
    if (!isOpen || !Number.isFinite(draftLat) || !Number.isFinite(draftLng)) {
      return;
    }

    const controller = new AbortController();
    setResolving(true);

    fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${draftLat}&longitude=${draftLng}&localityLanguage=en`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setResolvedAddress({
          locality: data.locality || "",
          city: data.city || data.locality || "",
          state: data.principalSubdivision || "",
          country: data.countryName || "",
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setResolving(false);
      });

    return () => controller.abort();
  }, [isOpen, draftLat, draftLng]);

  useEffect(() => {
    const q = searchText.trim();
    if (!isOpen || q.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          q,
          limit: "6",
          lang: "en",
          lat: String(draftLat),
          lon: String(draftLng),
        });
        const res = await fetch(
          `https://photon.komoot.io/api/?${params.toString()}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        const items = (data.features || []).map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          const p = f.properties || {};
          const label = [p.name, p.street, p.district || p.suburb, p.city, p.state]
            .filter(Boolean)
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .join(", ");
          return { label: label || "Selected place", lat, lng };
        });
        setSuggestions(items);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, searchText, draftLat, draftLng]);

  if (!isOpen) return null;

  const addressLabel = resolvedAddress
    ? [
        resolvedAddress.locality,
        resolvedAddress.city,
        resolvedAddress.state,
        resolvedAddress.country,
      ]
        .filter((v, i, arr) => v && arr.indexOf(v) === i)
        .join(", ")
    : "";

  const handleUseGps = () => {
    if (!Number.isFinite(gpsLocation?.lat) || !Number.isFinite(gpsLocation?.lng)) {
      return;
    }
    setDraftLat(gpsLocation.lat);
    setDraftLng(gpsLocation.lng);
  };

  return (
    <div className="gt-modal-backdrop" role="dialog" aria-modal="true">
      <div className="gt-modal-card">
        <div className="split" style={{ marginBottom: "8px" }}>
          <b style={{ fontSize: "14px" }}>Adjust report location</b>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close location picker"
          >
            <X size={18} />
          </button>
        </div>

        <p className="muted" style={{ marginTop: 0 }}>
          Tap anywhere on the map or search a street/sector to place the pin at the exact hazard spot.
        </p>

        <div className="search" style={{ margin: "8px 0" }}>
          <Search size={15} color="#81909a" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search street, sector or landmark..."
          />
        </div>

        {searching && <small className="muted">Searching places...</small>}

        {suggestions.length > 0 && (
          <div className="gt-suggestion-list">
            {suggestions.map((item, idx) => (
              <button
                key={`${item.lat}-${item.lng}-${idx}`}
                type="button"
                className="gt-suggestion-item"
                onClick={() => {
                  setDraftLat(item.lat);
                  setDraftLng(item.lng);
                  setSearchText("");
                  setSuggestions([]);
                }}
              >
                <MapPin size={13} color="#28d7a0" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            height: "230px",
            width: "100%",
            borderRadius: "10px",
            overflow: "hidden",
            border: "1px solid #25333e",
            margin: "8px 0",
          }}
        >
          <MapContainer
            center={[draftLat, draftLng]}
            zoom={16}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickSelector
              onSelect={(lat, lng) => {
                setDraftLat(lat);
                setDraftLng(lng);
              }}
            />
            <MapFlyTo lat={draftLat} lng={draftLng} />
            <CircleMarker
              center={[draftLat, draftLng]}
              radius={10}
              pathOptions={{
                color: "#ffffff",
                fillColor: "#28d7a0",
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Popup>Selected issue location</Popup>
            </CircleMarker>
          </MapContainer>
        </div>

        <div className="panel" style={{ margin: "8px 0", padding: "10px" }}>
          <div className="split">
            <b>{resolving ? "Resolving address..." : addressLabel || "Pinned spot"}</b>
            <span className="green">Pin ready</span>
          </div>
          <small className="muted" style={{ display: "block", marginTop: "4px" }}>
            {formatCoordinates(draftLat, draftLng)}
          </small>
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          {Number.isFinite(gpsLocation?.lat) && Number.isFinite(gpsLocation?.lng) && (
            <button
              type="button"
              className="btn secondary"
              style={{ flex: 1, margin: 0 }}
              onClick={handleUseGps}
            >
              <LocateFixed size={14} /> Reset to GPS
            </button>
          )}
          <button
            type="button"
            className="btn"
            style={{ flex: 1.4, margin: 0 }}
            onClick={() =>
              onSave({
                lat: draftLat,
                lng: draftLng,
                details: resolvedAddress,
              })
            }
          >
            Confirm this location
          </button>
        </div>
      </div>
    </div>
  );
}
