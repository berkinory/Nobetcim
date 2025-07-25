import { Info } from 'lucide-react';
import { FaSquareXTwitter, FaGithub } from 'react-icons/fa6';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { useState } from 'react';
import Image from 'next/image';

export default function InfoDialog() {
    const [isInfoOpen, setIsInfoOpen] = useState(false);

    return (
        <>
            <div className="absolute top-4 right-4 z-10">
                <div className="bg-background/95 backdrop-blur-sm rounded-lg shadow-xl p-2 border border-border">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setIsInfoOpen(true)}
                        title="Information"
                        aria-label="Uygulama bilgileri dialogunu aç"
                        className="h-8 w-8 md:h-10 md:w-10"
                    >
                        <Info size={16} className="md:w-5 md:h-5" />
                    </Button>
                </div>
            </div>

            <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-sm sm:max-w-md rounded-lg">
                    <DialogHeader>
                        <div className="flex items-start gap-3 mb-2">
                            <Image
                                src="/nobetcim.webp"
                                alt="Nöbetçi Eczaneler"
                                width={32}
                                height={32}
                                className="rounded-lg"
                            />
                            <div className="flex flex-col">
                                <DialogTitle className="text-left">
                                    nobetcim.app
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0 text-left">
                                    Ücretsiz Nöbetçi Eczane Servisi
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <div className="text-sm leading-relaxed font-mono">
                                <p>
                                    merhaba ben{' '}
                                    <span className="font-medium">miraç</span>,
                                    20 yasinda bir üniversite ogrencisiyim.
                                </p>
                                <p className="mb-3">
                                    bu sitenin kodları tamamen{' '}
                                    <span className="font-medium text-primary">
                                        acik kaynak
                                    </span>{' '}
                                    olarak GitHub'da paylasilmistir ve hicbir
                                    kar amaci gutmeden halka acik bir sekilde
                                    servis edilmektedir 🚀
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-medium mb-2">Kullanım</h4>
                            <ul className="space-y-1 text-sm text-muted-foreground">
                                <li>• Konum erişimine izin verin.</li>
                                <li>
                                    • Size en yakın 50 nöbetçi eczaneyi
                                    görüntüleyin.
                                </li>
                                <li>
                                    • Eczanelerin üzerine tıklayarak detayları
                                    görün.
                                </li>
                            </ul>
                        </div>
                        <div className="border-t pt-4">
                            <div className="flex items-center justify-center gap-4">
                                <a
                                    href="https://x.com/berkinory"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <FaSquareXTwitter size={20} />
                                    Twitter
                                </a>
                                <a
                                    href="https://github.com/berkinory/nobetcim"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
