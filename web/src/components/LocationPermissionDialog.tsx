'use client';

import { MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface LocationPermissionDialogProps {
    open: boolean;
    onLocationRequest: () => void;
    isRetry?: boolean;
}

export default function LocationPermissionDialog({
    open,
    onLocationRequest,
    onOpenChange,
    isRetry = false,
}: LocationPermissionDialogProps & { onOpenChange: (v: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-xs rounded-lg [&>button]:hidden"
                onEscapeKeyDown={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <div className="flex items-center justify-center w-10 h-10 mx-auto mb-3 bg-primary/10 rounded-xl border border-primary/20">
                        <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <DialogTitle className="text-center text-base font-semibold">
                        {isRetry ? 'Konum Alınamadı' : 'Konum İzinleri'}
                    </DialogTitle>
                    <DialogDescription className="text-center text-sm text-muted-foreground">
                        {isRetry
                            ? 'Konumunuz alınamadı. Lütfen konum servislerinizin açık olduğundan emin olun ve tekrar deneyin.'
                            : 'En yakın eczaneleri gösterebilmek için konumunuza erişim izni gerekiyor.'}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex flex-col gap-2 sm:flex-col">
                    <Button
                        onClick={onLocationRequest}
                        variant="default"
                        className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md text-sm"
                        size="sm"
                    >
                        <Navigation className="w-4 h-4 mr-2" />
                        {isRetry ? 'Tekrar Dene' : 'Konum İzni Ver'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
