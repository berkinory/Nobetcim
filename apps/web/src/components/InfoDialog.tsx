import { Info } from 'lucide-react';
import { useState } from 'react';
import { FaGithub, FaSquareXTwitter } from 'react-icons/fa6';

import { ControlButton, ControlGroup } from '@/components/MapControls';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export function InfoDialog({ missingCities }: { missingCities: string[] }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <ControlGroup>
                <ControlButton
                    onClick={() => setOpen(true)}
                    aria-label="Hakkında"
                >
                    <Info />
                </ControlButton>
            </ControlGroup>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-sm gap-4 rounded-xl">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <img
                                src="/nobetcim.webp"
                                alt=""
                                width={36}
                                height={36}
                                className="rounded-lg"
                            />
                            <div className="flex flex-col gap-1">
                                <DialogTitle className="text-left text-base">
                                    nobetcim.app
                                </DialogTitle>
                                <DialogDescription className="text-left text-xs">
                                    Ücretsiz, açık kaynak nöbetçi eczane
                                    haritası
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                        <p>
                            Nöbet listeleri ve saatleri, Sağlık Bakanlığı'nın
                            (TİTCK) e-Devlet'te yayımladığı resmi kayıtlardan
                            alınır. Listeler değişebilir; gitmeden önce eczaneyi
                            aramanızı öneririz.
                        </p>
                        {missingCities.length > 0 && (
                            <p className="text-xs">
                                Liste yayımlanmayan iller:{' '}
                                {missingCities.join(', ')}.
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                        <a
                            href="https://github.com/berkinory/nobetcim"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                        >
                            <FaGithub size={15} />
                            GitHub
                        </a>
                        <a
                            href="https://x.com/berkinory"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                        >
                            <FaSquareXTwitter size={15} />X
                        </a>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
