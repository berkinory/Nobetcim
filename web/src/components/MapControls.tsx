import {
    Navigation,
    SatelliteDish,
    Map as MapIcon,
    Plus,
    Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import InfoDialog from '@/components/InfoDialog';

const MAP_STYLES = [
    { id: 'custom', name: 'Street', icon: MapIcon },
    { id: 'satellite', name: 'Satellite', icon: SatelliteDish },
];

interface MapStyleSelectorProps {
    mapStyle: string;
    onStyleChange: (id: string) => void;
}

function MapStyleSelector({ mapStyle, onStyleChange }: MapStyleSelectorProps) {
    return (
        <div className="absolute top-4 left-4 z-10">
            <div className="bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-1 border border-border/50">
                <div className="flex gap-0.5">
                    {MAP_STYLES.map((style) => {
                        const Icon = style.icon;
                        return (
                            <Button
                                key={style.id}
                                variant={
                                    mapStyle === style.id
                                        ? 'default'
                                        : 'outline'
                                }
                                size="icon"
                                onClick={() => onStyleChange(style.id)}
                                title={`${style.name} Map`}
                                aria-label={`${style.name === 'Street' ? 'Sokak' : 'Uydu'} harita görünümüne geç`}
                                className="h-8 w-8 md:h-10 md:w-10"
                            >
                                <Icon size={16} className="md:w-5 md:h-5" />
                            </Button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

interface NavigationControlsProps {
    hasUserLocation: boolean;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onLocationFocus: () => void;
}

function NavigationControls({
    hasUserLocation,
    onZoomIn,
    onZoomOut,
    onLocationFocus,
}: NavigationControlsProps) {
    return (
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
            <div className="bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-1 border border-border/50">
                <div className="flex flex-col gap-0.5">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onZoomIn}
                        title="Zoom In"
                        aria-label="Haritayı yakınlaştır"
                        className="h-8 w-8 md:h-10 md:w-10"
                    >
                        <Plus size={16} className="md:w-5 md:h-5" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onZoomOut}
                        title="Zoom Out"
                        aria-label="Haritayı uzaklaştır"
                        className="h-8 w-8 md:h-10 md:w-10"
                    >
                        <Minus size={16} className="md:w-5 md:h-5" />
                    </Button>
                </div>
            </div>

            {hasUserLocation && (
                <div className="bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-1 border border-border/50">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onLocationFocus}
                        title="Center on my location"
                        aria-label="Konumuma odaklan"
                        className="h-8 w-8 md:h-10 md:w-10"
                    >
                        <Navigation size={16} className="md:w-5 md:h-5" />
                    </Button>
                </div>
            )}
        </div>
    );
}

interface MapControlsProps {
    mapStyle: string;
    hasUserLocation: boolean;
    onStyleChange: (styleId: string) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onLocationFocus: () => void;
}

export default function MapControls({
    mapStyle,
    hasUserLocation,
    onStyleChange,
    onZoomIn,
    onZoomOut,
    onLocationFocus,
}: MapControlsProps) {
    return (
        <>
            <MapStyleSelector
                mapStyle={mapStyle}
                onStyleChange={onStyleChange}
            />
            <NavigationControls
                hasUserLocation={hasUserLocation}
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                onLocationFocus={onLocationFocus}
            />
            <InfoDialog />
        </>
    );
}
