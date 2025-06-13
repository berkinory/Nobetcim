import { Navigation, Satellite, Map as MapIcon, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MAP_STYLES = [
    { id: 'custom', name: 'Street', icon: MapIcon },
    { id: 'satellite', name: 'Satellite', icon: Satellite },
];

const BUTTON_CLASS = 'h-8 w-8 md:h-10 md:w-10';
const CONTROL_GROUP_CLASS = 'bg-background/95 backdrop-blur-sm rounded-lg shadow-xl p-2 border border-border';

interface MapStyleSelectorProps {
    mapStyle: string;
    onStyleChange: (id: string) => void;
}

function MapStyleSelector({ mapStyle, onStyleChange }: MapStyleSelectorProps) {
    return (
        <div className="absolute top-4 left-4 z-10">
            <div className={CONTROL_GROUP_CLASS}>
                <div className="flex gap-1">
                    {MAP_STYLES.map((style) => {
                        const Icon = style.icon;
                        return (
                            <Button
                                key={style.id}
                                variant={mapStyle === style.id ? "default" : "outline"}
                                size="icon"
                                onClick={() => onStyleChange(style.id)}
                                title={`${style.name} Map`}
                                className={BUTTON_CLASS}
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

function NavigationControls({ hasUserLocation, onZoomIn, onZoomOut, onLocationFocus }: NavigationControlsProps) {
    return (
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
            <div className={CONTROL_GROUP_CLASS}>
                <div className="flex flex-col gap-1">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onZoomIn}
                        title="Zoom In"
                        className={BUTTON_CLASS}
                    >
                        <Plus size={16} className="md:w-5 md:h-5" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onZoomOut}
                        title="Zoom Out"
                        className={BUTTON_CLASS}
                    >
                        <Minus size={16} className="md:w-5 md:h-5" />
                    </Button>
                </div>
            </div>

            {/* Location Button */}
            {hasUserLocation && (
                <div className={CONTROL_GROUP_CLASS}>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onLocationFocus}
                        title="Center on my location"
                        className={BUTTON_CLASS}
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
    onLocationFocus
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
        </>
    );
} 