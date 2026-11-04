import { Clock, Info, MapPin, Phone, ShieldCheck, WifiOff } from 'lucide-react';
import { useState, type ReactNode } from 'react';
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

function Feature({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <li className="flex gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">
                {icon}
            </span>
            <span className="text-sm leading-relaxed text-muted-foreground">
                {children}
            </span>
        </li>
    );
}

export function InfoDialog({ missingCities }: { missingCities: string[] }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <ControlGroup>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setOpen(true)}
                    aria-label="Hakkında"
                    className="h-9 w-9 md:h-10 md:w-10"
                >
                    <Info />
                </Button>
            </ControlGroup>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[88dvh] w-[calc(100vw-2rem)] max-w-md gap-5 overflow-y-auto rounded-xl">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <img
                                src="/nobetcim.webp"
                                alt=""
                                width={40}
                                height={40}
                                className="rounded-lg"
                            />
                            <div className="flex flex-col gap-1">
                                <DialogTitle className="text-left">
                                    nobetcim.app
                                </DialogTitle>
                                <DialogDescription className="text-left text-xs">
                                    Türkiye nöbetçi eczane haritası
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <p className="text-sm leading-relaxed">
                        nobetcim.app, Türkiye genelinde o an nöbette olan
                        eczaneleri tek bir haritada gösteren ücretsiz ve açık
                        kaynaklı bir kamu hizmetidir. Reklam içermez; konumunuz
                        yalnızca cihazınızda kullanılır ve hiçbir sunucuya
                        gönderilmez.
                    </p>

                    <section>
                        <h3 className="mb-3 text-sm font-semibold">
                            Nasıl çalışır
                        </h3>
                        <ul className="space-y-3">
                            <Feature icon={<MapPin />}>
                                Haritada şu an nöbette olan tüm eczaneler yer
                                alır. Nöbeti henüz başlamamış olanlar soluk
                                gösterilir, nöbeti biten eczaneler kendiliğinden
                                kaldırılır.
                            </Feature>
                            <Feature icon={<Phone />}>
                                Konum izni verdiğinizde en yakın nöbetçi
                                eczaneler mesafeye göre sıralanır. Bir eczaneye
                                dokunarak arayabilir, adresini görebilir ve yol
                                tarifi alabilirsiniz.
                            </Feature>
                            <Feature icon={<WifiOff />}>
                                Son yüklenen liste cihazınızda saklanır;
                                bağlantınız olmadığında da görüntülenebilir.
                            </Feature>
                        </ul>
                    </section>

                    <section>
                        <h3 className="mb-3 text-sm font-semibold">
                            Veri kaynağı ve nöbet saatleri
                        </h3>
                        <ul className="space-y-3">
                            <Feature icon={<ShieldCheck />}>
                                Nöbet listeleri, il sağlık müdürlüklerince
                                onaylanarak e-Devlet üzerinden yayımlanan
                                Türkiye İlaç ve Tıbbi Cihaz Kurumu (TİTCK)
                                kayıtlarından alınır ve gün boyunca düzenli
                                olarak güncellenir.
                            </Feature>
                            <Feature icon={<Clock />}>
                                Her eczanenin nöbet başlangıç ve bitiş saati bu
                                resmi listeden gelir. Saatler ile göre değişir;
                                nöbetler genellikle akşam başlar ve ertesi sabah
                                sona erer.
                            </Feature>
                        </ul>
                        <p className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                            Nöbet listeleri zorunlu hallerde değiştirilebilir.
                            Eczaneye gitmeden önce telefonla teyit etmenizi
                            öneririz.
                        </p>
                        {missingCities.length > 0 && (
                            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                                <span className="font-medium text-foreground">
                                    Liste yayımlanmayan iller:
                                </span>{' '}
                                {missingCities.join(', ')}. Bu iller için resmi
                                kaynakta henüz nöbet bilgisi bulunmuyor.
                            </p>
                        )}
                    </section>

                    <footer className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                        <span>Açık kaynak · MIT lisansı</span>
                        <span className="flex items-center gap-4">
                            <a
                                href="https://github.com/berkinory/nobetcim"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                            >
                                <FaGithub size={16} />
                                GitHub
                            </a>
                            <a
                                href="https://x.com/berkinory"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                            >
                                <FaSquareXTwitter size={16} />X
                            </a>
                        </span>
                    </footer>
                </DialogContent>
            </Dialog>
        </>
    );
}
