from scraper import ScrapeSession, parser, scrape_pharmacies

__all__ = ["ScrapeSession", "parser", "scrape_pharmacies"]

if __name__ == "__main__":
    from dates import format_scrape_date, get_turkey_now

    today = format_scrape_date(get_turkey_now())
    print(parser("34", today))
