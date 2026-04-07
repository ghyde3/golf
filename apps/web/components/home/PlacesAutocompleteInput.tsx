"use client";

import { useEffect, useRef } from "react";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

type Props = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
};

/**
 * Google Places Autocomplete on a text input. Submits the visible address/region as `q` with the parent form.
 */
export function PlacesAutocompleteInput({
  name,
  defaultValue,
  placeholder,
  className,
  required,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!inputRef.current || !GOOGLE_KEY) return;

    let cancelled = false;
    let autocomplete: google.maps.places.Autocomplete | null = null;

    const attach = () => {
      if (cancelled || !inputRef.current || !window.google?.maps?.places) return;
      autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["(regions)"],
        fields: ["formatted_address", "name", "geometry"],
      });
    };

    if (typeof window !== "undefined" && window.google?.maps?.places) {
      attach();
      return () => {
        cancelled = true;
        autocomplete = null;
      };
    }

    const existing = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    ) as HTMLScriptElement | null;

    if (existing) {
      const onLoad = () => attach();
      existing.addEventListener("load", onLoad);
      return () => {
        cancelled = true;
        existing.removeEventListener("load", onLoad);
      };
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => attach();
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
      required={required}
    />
  );
}
