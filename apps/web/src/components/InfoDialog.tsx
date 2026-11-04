import { Info } from 'lucide-react';
import { useState } from 'react';
import { FaGithub, FaSquareXTwitter } from 'react-icons/fa6';

import { ControlGroup } from '@/components/MapControls';
import { Button } from '@/components/ui/button';
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
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setOpen(true)}
                    aria-label="Uygulama hakkında"
                    className="h-9 w-9 md:h-10 md:w-10"
                >
                    <Info />
                </Button>
            </ControlGroup>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-sm overflow-y-auto rounded-lg sm:max-w-md">
                    <DialogHeader>
                        <div className="mb-2 flex items-start gap-3">
                            <img
                                src="/nobetcim.webp"
                                alt=""
                                width={32}
                                height={32}
                                className="rounded-lg"
                            />
                            <div className="flex flex-col">
                                <DialogTitle className="text-left">
                                    nobetcim.app
                                </DialogTitle>
                                <DialogDescription className="mt-0 text-left text-xs">
                                    Ücretsiz Nöbetçi Eczane Servisi
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="font-mono text-sm leading-relaxed">
                            <p>
                                merhaba ben{' '}
                                <span className="font-medium">miraç</span>,
                            </p>
                            <p>
                                bu sitenin kodları tamamen{' '}
                                <span className="font-medium text-primary">
                                    açık kaynak
                                </span>{' '}
                                olarak GitHub'da paylaşılmıştır ve hiçbir kâr
                                amacı gütmeden halka açık bir şekilde servis
                                edilmektedir.
                            </p>
                        </div>

                        <div>
                            <h4 className="mb-2 font-medium">Kullanım</h4>
                            <ul className="space-y-1 text-sm text-muted-foreground">
                                <li>
                                    • Türkiye'deki tüm nöbetçi eczaneler
                                    haritada gösterilir.
                                </li>
                                <li>
                                    • Konum izni verirseniz size en yakın
                                    olanlar listelenir.
                                </li>
                                <li>
                                    • Eczaneye dokunarak telefon, adres ve yol
                                    tarifine ulaşın.
                                </li>
                                <li>
                                    • Şu an nöbette olanlar listenin başında;
                                    nöbeti henüz başlamayanlar soluk gösterilir,
                                    nöbeti bitenler kendiliğinden kalkar.
                                </li>
                                <li>
                                    • Uygulama son listeyi saklar; internet
                                    yokken de açılır.
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="mb-2 font-medium">Nöbet saatleri</h4>
                            <p className="text-sm text-muted-foreground">
                                Her eczanenin nöbet başlangıç ve bitiş saati, il
                                sağlık müdürlüğünce onaylanmış resmi listeden
                                alınır. Saatler ile göre değişir; çoğu nöbet
                                akşam 17:00 ile 19:00 arasında başlar, ertesi
                                sabah 08:00 ile 09:00 arasında biter. Bazı
                                eczaneler yalnızca gece yarısına kadar nöbet
                                tutar.
                            </p>
                        </div>

                        <div className="text-xs leading-relaxed text-muted-foreground">
                            Veriler e-Devlet üzerinden Sağlık Bakanlığı (TİTCK)
                            kayıtlarından alınır. Nöbet listeleri gün içinde
                            değişebilir; gitmeden önce eczaneyi aramanızı
                            öneririz.
                            {missingCities.length > 0 && (
                                <p className="mt-2">
                                    Bu nöbet için liste yayınlanmayan iller:{' '}
                                    {missingCities.join(', ')}.
                                </p>
                            )}
                        </div>

                        <div className="border-t pt-4">
                            <div className="flex items-center justify-center gap-4">
                                <a
                                    href="https://x.com/berkinory"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    <FaSquareXTwitter size={20} />X
                                </a>
                                <a
                                    href="https://github.com/berkinory/nobetcim"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    <FaGithub size={20} />
                                    GitHub
                                </a>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
