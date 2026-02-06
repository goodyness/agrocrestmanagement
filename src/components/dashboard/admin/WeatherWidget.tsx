import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Cloud, 
  Sun, 
  CloudRain, 
  Wind, 
  Thermometer, 
  Droplets,
  AlertTriangle,
  CloudSun,
  Snowflake,
  CloudFog,
  ThermometerSun,
  ThermometerSnowflake,
  Bird,
  Heart
} from "lucide-react";

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  precipitation: number;
  feelsLike: number;
  uvIndex: number;
}

interface ForecastDay {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  precipitation: number;
}

interface LivestockAlert {
  type: "warning" | "danger" | "info";
  title: string;
  message: string;
  livestock: string[];
}

const WEATHER_CODES: Record<number, { label: string; icon: React.ElementType }> = {
  0: { label: "Clear sky", icon: Sun },
  1: { label: "Mainly clear", icon: Sun },
  2: { label: "Partly cloudy", icon: CloudSun },
  3: { label: "Overcast", icon: Cloud },
  45: { label: "Foggy", icon: CloudFog },
  48: { label: "Depositing rime fog", icon: CloudFog },
  51: { label: "Light drizzle", icon: CloudRain },
  53: { label: "Moderate drizzle", icon: CloudRain },
  55: { label: "Dense drizzle", icon: CloudRain },
  61: { label: "Slight rain", icon: CloudRain },
  63: { label: "Moderate rain", icon: CloudRain },
  65: { label: "Heavy rain", icon: CloudRain },
  71: { label: "Slight snow", icon: Snowflake },
  73: { label: "Moderate snow", icon: Snowflake },
  75: { label: "Heavy snow", icon: Snowflake },
  80: { label: "Slight showers", icon: CloudRain },
  81: { label: "Moderate showers", icon: CloudRain },
  82: { label: "Violent showers", icon: CloudRain },
  95: { label: "Thunderstorm", icon: CloudRain },
  96: { label: "Thunderstorm with hail", icon: CloudRain },
  99: { label: "Thunderstorm with hail", icon: CloudRain },
};

// Nigerian cities coordinates (common farm locations)
const LOCATIONS: Record<string, { lat: number; lon: number; name: string }> = {
  abeokuta: { lat: 7.1475, lon: 3.3619, name: "Abeokuta" },
  ibadan: { lat: 7.3775, lon: 3.9470, name: "Ibadan" },
  oyo: { lat: 7.8500, lon: 3.9333, name: "Oyo" },
  lagos: { lat: 6.5244, lon: 3.3792, name: "Lagos" },
  default: { lat: 7.3775, lon: 3.9470, name: "Southwest Nigeria" },
};

interface WeatherWidgetProps {
  branchLocation?: string | null;
}

const WeatherWidget = ({ branchLocation }: WeatherWidgetProps) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState("Farm Location");

  // Get coordinates based on branch location
  const getCoordinates = () => {
    if (!branchLocation) return LOCATIONS.default;
    const locationKey = branchLocation.toLowerCase().trim();
    for (const [key, value] of Object.entries(LOCATIONS)) {
      if (locationKey.includes(key) || key.includes(locationKey)) {
        return value;
      }
    }
    return LOCATIONS.default;
  };

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        const coords = getCoordinates();
        setLocationName(coords.name);

        // Using Open-Meteo API (free, no API key needed)
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Africa%2FLagos&forecast_days=5`
        );

        if (!response.ok) throw new Error("Failed to fetch weather");

        const data = await response.json();

        setWeather({
          temperature: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          windSpeed: data.current.wind_speed_10m,
          weatherCode: data.current.weather_code,
          precipitation: data.current.precipitation,
          feelsLike: data.current.apparent_temperature,
          uvIndex: data.current.uv_index,
        });

        const forecastDays: ForecastDay[] = data.daily.time.slice(0, 5).map((date: string, i: number) => ({
          date,
          tempMax: data.daily.temperature_2m_max[i],
          tempMin: data.daily.temperature_2m_min[i],
          weatherCode: data.daily.weather_code[i],
          precipitation: data.daily.precipitation_sum[i],
        }));
        setForecast(forecastDays);
        setError(null);
      } catch (err) {
        console.error("Weather fetch error:", err);
        setError("Unable to fetch weather data");
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    // Refresh every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [branchLocation]);

  // Generate livestock-specific alerts based on weather conditions
  const getLivestockAlerts = (): LivestockAlert[] => {
    if (!weather) return [];
    const alerts: LivestockAlert[] = [];

    // Heat stress alerts (poultry are very sensitive to heat)
    if (weather.temperature > 35) {
      alerts.push({
        type: "danger",
        title: "Extreme Heat Alert",
        message: "Temperatures above 35°C cause severe heat stress. Increase ventilation, provide cool water, and reduce stocking density. Consider spraying water on roofs.",
        livestock: ["Layers", "Broilers", "Cockerels", "Pullets"],
      });
    } else if (weather.temperature > 30) {
      alerts.push({
        type: "warning",
        title: "Heat Stress Warning",
        message: "High temperatures may reduce feed intake and egg production. Ensure adequate water supply and ventilation.",
        livestock: ["Layers", "Broilers"],
      });
    }

    // Cold stress (rare in Nigeria but possible in harmattan)
    if (weather.temperature < 20) {
      alerts.push({
        type: "warning",
        title: "Cold Weather Alert",
        message: "Provide extra bedding and reduce drafts. Young chicks are especially vulnerable. Consider supplemental heating.",
        livestock: ["Chicks", "Pullets"],
      });
    }

    // High humidity
    if (weather.humidity > 85) {
      alerts.push({
        type: "warning",
        title: "High Humidity Alert",
        message: "Humidity above 85% increases ammonia buildup and disease risk. Improve ventilation and check litter conditions.",
        livestock: ["All Poultry"],
      });
    }

    // Rain/wet conditions
    if (weather.precipitation > 10 || [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weather.weatherCode)) {
      alerts.push({
        type: "info",
        title: "Wet Weather Advisory",
        message: "Heavy rain expected. Check roof leaks, drainage around pens, and protect feed storage from moisture.",
        livestock: ["All Livestock"],
      });
    }

    // Strong winds
    if (weather.windSpeed > 30) {
      alerts.push({
        type: "warning",
        title: "High Wind Warning",
        message: "Secure loose roofing and structures. Wind can stress birds and damage facilities.",
        livestock: ["All Poultry"],
      });
    }

    // UV index warning
    if (weather.uvIndex > 8) {
      alerts.push({
        type: "info",
        title: "High UV Index",
        message: "Provide adequate shade for free-range birds. Avoid outdoor activities during peak sun hours.",
        livestock: ["Free-range Poultry"],
      });
    }

    return alerts;
  };

  const getWeatherIcon = (code: number) => {
    const weatherInfo = WEATHER_CODES[code] || WEATHER_CODES[0];
    const IconComponent = weatherInfo.icon;
    return <IconComponent className="h-8 w-8" />;
  };

  const getWeatherLabel = (code: number) => {
    return WEATHER_CODES[code]?.label || "Unknown";
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
  };

  const livestockAlerts = getLivestockAlerts();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Weather & Farm Planning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Weather & Farm Planning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Weather & Farm Planning
            </CardTitle>
            <CardDescription>{locationName}</CardDescription>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Bird className="h-3 w-3" />
            Livestock Aware
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Weather */}
        {weather && (
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className="text-primary">
                {getWeatherIcon(weather.weatherCode)}
              </div>
              <div>
                <p className="text-3xl font-bold">{Math.round(weather.temperature)}°C</p>
                <p className="text-sm text-muted-foreground">{getWeatherLabel(weather.weatherCode)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <ThermometerSun className="h-3 w-3" />
                Feels {Math.round(weather.feelsLike)}°
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Droplets className="h-3 w-3" />
                {weather.humidity}%
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Wind className="h-3 w-3" />
                {Math.round(weather.windSpeed)} km/h
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Sun className="h-3 w-3" />
                UV {weather.uvIndex}
              </div>
            </div>
          </div>
        )}

        {/* Livestock Alerts */}
        {livestockAlerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              Livestock Health Alerts
            </h4>
            {livestockAlerts.map((alert, index) => (
              <Alert 
                key={index} 
                variant={alert.type === "danger" ? "destructive" : "default"}
                className={alert.type === "warning" ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20" : ""}
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="flex items-center gap-2">
                  {alert.title}
                  <Badge variant="outline" className="text-xs">
                    {alert.livestock.join(", ")}
                  </Badge>
                </AlertTitle>
                <AlertDescription className="text-sm mt-1">
                  {alert.message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {livestockAlerts.length === 0 && weather && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
            <Heart className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700 dark:text-green-400">
              Weather conditions are favorable for all livestock
            </span>
          </div>
        )}

        {/* 5-Day Forecast */}
        <div>
          <h4 className="text-sm font-semibold mb-2">5-Day Forecast</h4>
          <div className="grid grid-cols-5 gap-2">
            {forecast.map((day) => {
              const DayIcon = WEATHER_CODES[day.weatherCode]?.icon || Cloud;
              return (
                <div key={day.date} className="text-center p-2 bg-muted/30 rounded-lg">
                  <p className="text-xs font-medium">{formatDate(day.date)}</p>
                  <DayIcon className="h-5 w-5 mx-auto my-1 text-primary" />
                  <p className="text-xs">
                    <span className="font-semibold">{Math.round(day.tempMax)}°</span>
                    <span className="text-muted-foreground"> / {Math.round(day.tempMin)}°</span>
                  </p>
                  {day.precipitation > 0 && (
                    <p className="text-xs text-blue-500 flex items-center justify-center gap-0.5">
                      <Droplets className="h-2 w-2" />
                      {day.precipitation}mm
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Weather Impact Tips */}
        <div className="border-t pt-3">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Thermometer className="h-4 w-4" />
            Weather Impact on Livestock
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div className="flex items-start gap-2 p-2 bg-muted/30 rounded">
              <ThermometerSun className="h-4 w-4 text-orange-500 mt-0.5" />
              <div>
                <p className="font-medium">Heat (30°C+)</p>
                <p className="text-muted-foreground">↓ Feed intake, ↓ Egg production, ↑ Water needs</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 bg-muted/30 rounded">
              <ThermometerSnowflake className="h-4 w-4 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium">Cold ({"<"}20°C)</p>
                <p className="text-muted-foreground">↑ Feed intake, ↓ Growth rate (chicks)</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 bg-muted/30 rounded">
              <Droplets className="h-4 w-4 text-cyan-500 mt-0.5" />
              <div>
                <p className="font-medium">High Humidity (85%+)</p>
                <p className="text-muted-foreground">↑ Disease risk, ↑ Ammonia levels</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 bg-muted/30 rounded">
              <CloudRain className="h-4 w-4 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium">Heavy Rain</p>
                <p className="text-muted-foreground">Check drainage, protect feed stores</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeatherWidget;
