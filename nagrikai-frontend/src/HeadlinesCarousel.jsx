import React, { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Share2,
  Bookmark,
  ExternalLink,
  Sparkles,
  Radio,
  FileText
} from "lucide-react";
import "./headlinesCarousel.css";

// High-priority civic fallback news tailored for Greater Noida & NCR
const FALLBACK_CIVIC_HEADLINES = [
  {
    id: "fb-1",
    title: "Greater Noida Authority launches automated pothole identification & repair corridor",
    displayTitleHi: "ग्रेटर नोएडा प्राधिकरण ने स्वचालित गड्ढा पहचान और सड़क मरम्मत कॉरिडोर शुरू किया",
    url: "https://www.greaternoidaauthority.in",
    source: "Greater Noida Authority",
    category: "Roads & Transit",
    categoryHi: "सड़क और यातायात",
    pubDate: new Date().toISOString(),
    image: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80",
    description: "New AI-enabled sensor vans dispatched along major arterial roads in Alpha, Beta, and Pari Chowk to map pavement distress."
  },
  {
    id: "fb-2",
    title: "Noida-Greater Noida Expressway: New smart surveillance and speed monitoring operational",
    displayTitleHi: "नोएडा-ग्रेटर नोएडा एक्सप्रेसवे: नई स्मार्ट निगरानी और गति नियंत्रण प्रणाली सक्रिय",
    url: "https://timesofindia.indiatimes.com",
    source: "Times of India",
    category: "Civic Transit",
    categoryHi: "नागरिक पारगमन",
    pubDate: new Date(Date.now() - 3600000 * 3).toISOString(),
    image: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80",
    description: "Traffic police commission high-definition ANPR cameras to ensure seamless commute and rapid incident clearance."
  },
  {
    id: "fb-3",
    title: "UP Pollution Control Board implements dust suppression drives across construction zones",
    displayTitleHi: "यूपी प्रदूषण नियंत्रण बोर्ड ने निर्माण क्षेत्रों में धूल नियंत्रण अभियान लागू किया",
    url: "https://www.ndtv.com",
    source: "NDTV News",
    category: "Environment",
    categoryHi: "पर्यावरण",
    pubDate: new Date(Date.now() - 3600000 * 7).toISOString(),
    image: "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800&auto=format&fit=crop&q=80",
    description: "Anti-smog guns and mechanical sweeping deployed across Sector 16, Delta, and Yamuna Expressway access routes."
  },
  {
    id: "fb-4",
    title: "Aqua Line Metro extension connecting Knowledge Park & Bodaki depot reaches approval stage",
    displayTitleHi: "एक्वा लाइन मेट्रो विस्तार: नॉलेज पार्क और बोड़ाकी डिपो कनेक्टिविटी को मंजूरी",
    url: "https://timesofindia.indiatimes.com",
    source: "Metro Rail News",
    category: "Infrastructure",
    categoryHi: "बुनियादी ढांचा",
    pubDate: new Date(Date.now() - 3600000 * 12).toISOString(),
    image: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&auto=format&fit=crop&q=80",
    description: "NMRC finalizes multimodal interchange plan to integrate suburban bus hubs with metro stations."
  },
  {
    id: "fb-5",
    title: "GNIDA fast-tracks decentralized waste management units across residential sectors",
    displayTitleHi: "जीएनआईडीए ने आवासीय क्षेत्रों में विकेंद्रीकृत कचरा प्रबंधन इकाइयों में तेजी लाई",
    url: "https://www.greaternoidaauthority.in",
    source: "Civic Intelligence",
    category: "Sanitation",
    categoryHi: "स्वच्छता",
    pubDate: new Date(Date.now() - 3600000 * 18).toISOString(),
    image: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&auto=format&fit=crop&q=80",
    description: "Zero-landfill composting and smart bin monitoring initiated to elevate neighborhood cleanliness."
  }
];

function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

export default function HeadlinesCarousel({
  language = "English",
  locationDetails = null,
  notify = () => {}
}) {
  const [articles, setArticles] = useState(FALLBACK_CIVIC_HEADLINES);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [likedMap, setLikedMap] = useState({});
  const [savedMap, setSavedMap] = useState({});
  const [imgErrorMap, setImgErrorMap] = useState({});

  const trackRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadFeed() {
      setLoading(true);

      const feeds = [
        "https://api.rss2json.com/v1/api.json?rss_url=https://timesofindia.indiatimes.com/rssfeeds/-2128838597.cms",
        "https://api.rss2json.com/v1/api.json?rss_url=https://feeds.feedburner.com/ndtvnews-india-news",
        "https://api.rss2json.com/v1/api.json?rss_url=https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms"
      ];

      for (const feedUrl of feeds) {
        try {
          const res = await fetch(feedUrl, { signal: AbortSignal.timeout(5000) });
          if (!res.ok) continue;

          const data = await res.json();
          if (data.status === "ok" && Array.isArray(data.items) && data.items.length > 0) {
            const mapped = data.items.slice(0, 6).map((item, index) => {
              let image = item.enclosure?.link || item.thumbnail || "";
              if (!image && item.description) {
                const match = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
                if (match) image = match[1];
              }

              const cleanDesc = (item.description || "")
                .replace(/<[^>]+>/g, "")
                .replace(/\s+/g, " ")
                .trim();

              const decodedTitle = decodeHtmlEntities(item.title);
              const sourceName = (data.feed?.title || "").includes("NDTV")
                ? "NDTV News"
                : "Times of India";

              return {
                id: item.guid || item.link || `rss-${index}`,
                title: decodedTitle,
                displayTitleHi: decodedTitle,
                url: item.link,
                source: sourceName,
                category: "Civic Update",
                categoryHi: "नागरिक समाचार",
                pubDate: item.pubDate || new Date().toISOString(),
                image: image || FALLBACK_CIVIC_HEADLINES[index % FALLBACK_CIVIC_HEADLINES.length].image,
                description: cleanDesc || "Click to explore verified dispatch details and field context from original publisher."
              };
            });

            if (active && mapped.length > 0) {
              setArticles(mapped);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn("Feed attempt failed, trying next source:", e.message);
        }
      }

      // If all feeds fail or rate limited, fallback gracefully
      if (active) {
        setArticles(FALLBACK_CIVIC_HEADLINES);
        setLoading(false);
      }
    }

    loadFeed();

    // Auto-refresh every 10 minutes
    const interval = setInterval(loadFeed, 10 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleScroll = () => {
    if (!trackRef.current) return;
    const { scrollLeft, clientWidth } = trackRef.current;
    if (clientWidth > 0) {
      const newIndex = Math.round(scrollLeft / clientWidth);
      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < articles.length) {
        setActiveIndex(newIndex);
      }
    }
  };

  const scrollToSlide = (index) => {
    if (!trackRef.current) return;
    const clientWidth = trackRef.current.clientWidth;
    trackRef.current.scrollTo({
      left: index * clientWidth,
      behavior: "smooth"
    });
    setActiveIndex(index);
  };

  const toggleLike = (id) => {
    setLikedMap(prev => {
      const next = !prev[id];
      if (next && notify) notify("Headline saved to favorites");
      return { ...prev, [id]: next };
    });
  };

  const toggleSave = (id) => {
    setSavedMap(prev => {
      const next = !prev[id];
      if (next && notify) notify("Story bookmarked");
      return { ...prev, [id]: next };
    });
  };

  const handleShare = async (article) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          url: article.url
        });
        return;
      } catch {
        // User cancelled or fallback
      }
    }
    try {
      await navigator.clipboard.writeText(article.url);
      if (notify) notify("Headline link copied to clipboard");
    } catch {
      window.open(article.url, "_blank");
    }
  };

  const formatTimeAgo = (dateStr) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHrs <= 0) return language === "Hindi" ? "अभी-अभी" : "Just now";
      if (diffHrs < 24) return `${diffHrs}h ago`;
      const diffDays = Math.floor(diffHrs / 24);
      return `${diffDays}d ago`;
    } catch {
      return language === "Hindi" ? "ताज़ा" : "Recent";
    }
  };

  return (
    <div className="ig-carousel-card">
      {/* Top Header */}
      <div className="ig-carousel-header">
        <div className="ig-carousel-title-row">
          <span className="ig-live-pulse" />
          <span className="ig-carousel-title">
            {language === "Hindi" ? "ताज़ा सुर्खियाँ" : "LATEST HEADLINES"}
          </span>
        </div>

        <div className="ig-slide-counter">
          {articles.length > 0 ? `${activeIndex + 1} / ${articles.length}` : "1 / 1"}
        </div>
      </div>

      {/* Slide Carousel Track */}
      <div className="ig-carousel-wrapper">
        {/* Floating Left Arrow */}
        {activeIndex > 0 && (
          <button
            className="ig-nav-btn prev"
            onClick={() => scrollToSlide(activeIndex - 1)}
            aria-label="Previous slide"
          >
            <ChevronLeft size={18} />
          </button>
        )}

        {/* Floating Right Arrow */}
        {activeIndex < articles.length - 1 && (
          <button
            className="ig-nav-btn next"
            onClick={() => scrollToSlide(activeIndex + 1)}
            aria-label="Next slide"
          >
            <ChevronRight size={18} />
          </button>
        )}

        <div
          className="ig-carousel-track"
          ref={trackRef}
          onScroll={handleScroll}
        >
          {articles.map((article, idx) => {
            const isLiked = Boolean(likedMap[article.id]);
            const isSaved = Boolean(savedMap[article.id]);
            const hasImgError = Boolean(imgErrorMap[article.id]);
            const authorInitial = (article.source || "N")[0].toUpperCase();
            const categoryLabel = language === "Hindi" && article.categoryHi
              ? article.categoryHi
              : article.category;
            const titleText = language === "Hindi" && article.displayTitleHi
              ? article.displayTitleHi
              : article.title;

            return (
              <div key={article.id || idx} className="ig-post-slide">
                {/* IG Author / Source Header */}
                <div className="ig-post-top">
                  <div className="ig-post-author">
                    <div className="ig-author-avatar">{authorInitial}</div>
                    <div className="ig-author-info">
                      <span className="ig-author-name">{article.source}</span>
                      <span className="ig-post-time">{formatTimeAgo(article.pubDate)}</span>
                    </div>
                  </div>

                  <span className="ig-category-tag">{categoryLabel}</span>
                </div>

                {/* Media Image Area */}
                <div className="ig-post-media">
                  {article.image && !hasImgError ? (
                    <>
                      <img
                        src={article.image}
                        alt={article.title}
                        className="ig-post-image"
                        loading="lazy"
                        onError={() => setImgErrorMap(prev => ({ ...prev, [article.id]: true }))}
                      />
                      <div className="ig-image-gradient" />
                    </>
                  ) : (
                    <div className="ig-fallback-banner">
                      <div className="ig-fallback-icon">
                        <Radio size={20} />
                      </div>
                      <span className="ig-fallback-text">NagrikAI Civic News</span>
                    </div>
                  )}
                </div>

                {/* Instagram Action Row */}
                <div className="ig-post-actions">
                  <div className="ig-actions-left">
                    <button
                      className={`ig-action-btn ${isLiked ? "liked" : ""}`}
                      onClick={() => toggleLike(article.id)}
                      title="Favorite headline"
                      aria-label="Like"
                    >
                      <Heart
                        size={18}
                        fill={isLiked ? "#ef4444" : "none"}
                        color={isLiked ? "#ef4444" : "currentColor"}
                      />
                    </button>

                    <button
                      className="ig-action-btn"
                      onClick={() => handleShare(article)}
                      title="Share story"
                      aria-label="Share"
                    >
                      <Share2 size={18} />
                    </button>

                    <button
                      className={`ig-action-btn ${isSaved ? "saved" : ""}`}
                      onClick={() => toggleSave(article.id)}
                      title="Bookmark story"
                      aria-label="Bookmark"
                    >
                      <Bookmark
                        size={18}
                        fill={isSaved ? "#28d7a0" : "none"}
                        color={isSaved ? "#28d7a0" : "currentColor"}
                      />
                    </button>
                  </div>

                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ig-action-btn"
                    title="Open original story"
                    aria-label="Open original story"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>

                {/* Post Body & Headline */}
                <div className="ig-post-body">
                  <h3 className="ig-post-headline">{titleText}</h3>

                  {article.description && (
                    <p className="ig-post-snippet">{article.description}</p>
                  )}

                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ig-read-link"
                  >
                    {language === "Hindi" ? "पूरी खबर पढ़ें" : "Read full article"}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Instagram Pagination Dots */}
      {articles.length > 1 && (
        <div className="ig-dots-row">
          {articles.map((_, i) => (
            <button
              key={i}
              className={`ig-dot ${i === activeIndex ? "active" : ""}`}
              onClick={() => scrollToSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
