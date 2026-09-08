// server/constants/localization.js
// Multilingual support strings for en, hi, pa, mr (PRD Section 7)

const LOCALIZATION = {
    en: {
        roles: {
            farmer: 'Farmer',
            local_aggregator: 'Local Aggregator',
            wholesaler: 'Wholesaler / Trader',
            manufacturer: 'Processor / Manufacturer',
            distributor: 'Distributor / Logistics Partner',
            final_retailer: 'Final Retailer',
        },
        order_status: {
            order_placed: 'Order Placed',
            confirmed: 'Confirmed',
            packed: 'Packed',
            shipped: 'Shipped / Dispatched',
            out_for_delivery: 'Out for Delivery',
            delivered: 'Delivered',
            cancelled: 'Cancelled',
        },
        trust_pillars: {
            payment_reliability: 'Payment Reliability & Speed (35% weight)',
            order_fulfillment: 'Order Fulfillment & Rejection Rate (25% weight)',
            operational_punctuality: 'Operational Punctuality (20% weight)',
            peer_reviews: 'Community Peer Reviews (20% weight)',
        },
        route_justifications: {
            low_trust: 'Tier skipped due to low Trust Score ({score}/100, threshold is 80/100).',
            low_price: 'Tier skipped due to low price anomaly: offered price was {variance}% below live market index (threshold is -5%).',
            unavailable: 'Tier skipped because no verified and available buyers were found in the expanded search radius.',
            standard_route: 'Standard sequential route passed all checks: Availability, Trust Score, and Market Price Fairness.',
        },
    },
    hi: {
        roles: {
            farmer: 'किसान (उत्पादक)',
            local_aggregator: 'स्थानीय संग्रहकर्ता (एग्रीगेटर)',
            wholesaler: 'थोक व्यापारी',
            manufacturer: 'प्रसंस्करणकर्ता / निर्माता',
            distributor: 'वितरक / लॉजिस्टिक्स पार्टनर',
            final_retailer: 'अंतिम खुदरा विक्रेता',
        },
        order_status: {
            order_placed: 'ऑर्डर दिया गया',
            confirmed: 'पुष्ट किया गया',
            packed: 'पैक किया गया',
            shipped: 'भेजा गया',
            out_for_delivery: 'डिलीवरी के लिए निकला',
            delivered: 'डिलीवर किया गया',
            cancelled: 'रद्द किया गया',
        },
        trust_pillars: {
            payment_reliability: 'भुगतान विश्वसनीयता और गति (35% भार)',
            order_fulfillment: 'ऑर्डर पूर्ति और अस्वीकृति दर (25% भार)',
            operational_punctuality: 'परिचालन समय की पाबंदी (20% भार)',
            peer_reviews: 'समुदाय समीक्षाएं (20% भार)',
        },
        route_justifications: {
            low_trust: 'कम ट्रस्ट स्कोर ({score}/100, सीमा 80/100) के कारण यह चरण छोड़ दिया गया।',
            low_price: 'कम मूल्य विसंगति: प्रस्तावित मूल्य बाजार सूचकांक से {variance}% कम था (सीमा -5% है)।',
            unavailable: 'खोज दायरे में कोई सत्यापित और उपलब्ध खरीदार न होने के कारण यह चरण छोड़ दिया गया।',
            standard_route: 'मानक मार्ग ने सभी जांच पास की: उपलब्धता, ट्रस्ट स्कोर और उचित बाजार मूल्य।',
        },
    },
    pa: {
        roles: {
            farmer: 'ਕਿਸਾਨ (ਉਤਪਾਦਕ)',
            local_aggregator: 'ਸਥਾਨਕ ਇਕੱਠਾਕਰਤਾ (ਐਗਰੀਗੇਟਰ)',
            wholesaler: 'ਥੋਕ ਵਪਾਰੀ',
            manufacturer: 'ਪ੍ਰੋਸੈਸਰ / ਨਿਰਮਾਤਾ',
            distributor: 'ਵਿਤਰਕ / ਲੌਜਿਸਟਿਕਸ ਪਾਰਟਨਰ',
            final_retailer: 'ਅੰਤਮ ਪ੍ਰਚੂਨ ਵਿਕਰੇਤਾ',
        },
        order_status: {
            order_placed: 'ਆਰਡਰ ਦਿੱਤਾ ਗਿਆ',
            confirmed: 'ਪੁਸ਼ਟੀ ਕੀਤੀ ਗਈ',
            packed: 'ਪੈਕ ਕੀਤਾ ਗਿਆ',
            shipped: 'ਭੇਜਿਆ ਗਿਆ',
            out_for_delivery: 'ਡਿਲੀਵਰੀ ਲਈ ਨਿਕਲਿਆ',
            delivered: 'ਡਿਲੀਵਰ ਹੋ ਗਿਆ',
            cancelled: 'ਰੱਦ ਕੀਤਾ ਗਿਆ',
        },
        trust_pillars: {
            payment_reliability: 'ਭੁਗਤਾਨ ਭਰੋਸੇਯੋਗਤਾ ਅਤੇ ਗਤੀ (35% ਭਾਰ)',
            order_fulfillment: 'ਆਰਡਰ ਪੂਰਤੀ ਅਤੇ ਰੱਦ ਦਰ (25% ਭਾਰ)',
            operational_punctuality: 'ਸਮੇਂ ਦੀ ਪਾਬੰਦੀ (20% ਭਾਰ)',
            peer_reviews: 'ਭਾਈਚਾਰਕ ਸਮੀਖਿਆਵਾਂ (20% ਭਾਰ)',
        },
        route_justifications: {
            low_trust: 'ਘੱਟ ਟਰੱਸਟ ਸਕੋਰ ({score}/100, ਸੀਮਾ 80/100) ਕਾਰਨ ਇਹ ਪੜਾਅ ਛੱਡਿਆ ਗਿਆ।',
            low_price: 'ਘੱਟ ਕੀਮਤ: ਪੇਸ਼ ਕੀਤੀ ਗਈ ਕੀਮਤ ਬਾਜ਼ਾਰ ਸੂਚਕਾਂਕ ਨਾਲੋਂ {variance}% ਘੱਟ ਸੀ (ਸੀਮਾ -5% ਹੈ)।',
            unavailable: 'ਖੋਜ ਖੇਤਰ ਵਿੱਚ ਕੋਈ ਪ੍ਰਮਾਣਿਤ ਖਰੀਦਦਾਰ ਉਪਲਬਧ ਨਾ ਹੋਣ ਕਾਰਨ ਇਹ ਪੜਾਅ ਛੱਡਿਆ ਗਿਆ।',
            standard_route: 'ਮਿਆਰੀ ਰਸਤੇ ਨੇ ਸਾਰੀਆਂ ਸ਼ਰਤਾਂ ਪਾਸ ਕੀਤੀਆਂ।',
        },
    },
    mr: {
        roles: {
            farmer: 'शेतकरी (उत्पादक)',
            local_aggregator: 'स्थानिक संकलक (एग्रीगेटर)',
            wholesaler: 'घाऊक व्यापारी',
            manufacturer: 'प्रक्रियादार / उत्पादक',
            distributor: 'वितरक / लॉजिस्टिक भागीदार',
            final_retailer: 'अंतिम किरकोळ विक्रेता',
        },
        order_status: {
            order_placed: 'ऑर्डर दिली',
            confirmed: 'पुष्टी केली',
            packed: 'पॅक केले',
            shipped: 'पाठवले',
            out_for_delivery: 'वितरणासाठी बाहेर पडले',
            delivered: 'वितरित केले',
            cancelled: 'रद्द केले',
        },
        trust_pillars: {
            payment_reliability: 'पेमेंट विश्वसनीयता आणि गती (३५% महत्त्व)',
            order_fulfillment: 'ऑर्डर पूर्तता आणि नकार दर (२५% महत्त्व)',
            operational_punctuality: 'कामातील वक्तशीरपणा (२०% महत्त्व)',
            peer_reviews: 'समुदाय पुनरावलोकन (२०% महत्त्व)',
        },
        route_justifications: {
            low_trust: 'कमी ट्रस्ट स्कोअरमुळे ({score}/100, मर्यादा 80/100) हा टप्पा वगळला.',
            low_price: 'कमी किंमतीची विसंगती: दिलेली किंमत थेट बाजार निर्देशांकापेक्षा {variance}% कमी होती (मर्यादा -5% आहे).',
            unavailable: 'शोध कक्षेत कोणतेही सत्यापित आणि उपलब्ध खरेदीदार न आढळल्याने हा टप्पा वगळला.',
            standard_route: 'मानक मार्गाने सर्व निकष पूर्ण केले.',
        },
    },
};

function getLocalizedText(lang, category, key, params = {}) {
    const selectedLang = LOCALIZATION[lang] ? lang : 'en';
    let text = LOCALIZATION[selectedLang]?.[category]?.[key] || LOCALIZATION['en']?.[category]?.[key] || key;
    
    Object.keys(params).forEach(p => {
        text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
    });
    
    return text;
}

module.exports = {
    LOCALIZATION,
    getLocalizedText,
};
