// import React, { useState, useEffect } from 'react';
// import { 
//   ShoppingBag, 
//   MessageCircle, 
//   ShieldCheck, 
//   Sparkles, 
//   ChevronRight, 
//   X, 
//   Plus, 
//   Minus, 
//   Check, 
//   Search, 
//   Filter, 
//   Box, 
//   Fish, 
//   Bird, 
//   Heart, 
//   MapPin, 
//   Phone, 
//   Mail, 
//   ExternalLink,
//   Award,
//   Layers,
//   Zap,
//   Info,
//   Sliders,
//   Menu,
//   CheckCircle2,
//   HelpCircle,
//   ArrowRight
// } from 'lucide-react';

// // --- MOCK DATABASE & PRODUCTS ---
// const PRODUCTS = [
//   {
//     id: 'p1',
//     name: 'Freeze Dried Shrimp (High Protein)',
//     category: 'Bio-Nutrition',
//     price: 650,
//     rating: 4.9,
//     reviews: 128,
//     badge: 'Best Seller',
//     tag: '100% Natural',
//     image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=800',
//     description: 'Ultra-pure 60%+ crude protein freeze-dried freshwater shrimp. Naturally enhances carotenoids for deep crimson & golden scale shimmer in apex predators.',
//     specs: ['Crude Protein: >60%', 'Clean-Water Formula', 'Zero Artificial Color', 'Suitable for Arowana, Channa & Cichlids'],
//     popularFor: 'Arowana, Channa, Monster Fish'
//   },
//   {
//     id: 'p2',
//     name: 'Channa Stick Special 125g',
//     category: 'Bio-Nutrition',
//     price: 480,
//     rating: 4.8,
//     reviews: 94,
//     badge: 'Specialized Formula',
//     tag: 'Pellet Tech',
//     image: 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&q=80&w=800',
//     description: 'Precision floating pellets engineered specifically for Snakeheads (Channa Barca, Marulioides, Bleheri). Rich in spirulina and natural peptides.',
//     specs: ['Weight: 125g', 'Buoyancy: Slow Floating', 'Non-Clouding Formula', 'Immunity & Aggression Boost'],
//     popularFor: 'Channa Barca, Maruliodes, Stewartii'
//   },
//   {
//     id: 'p3',
//     name: 'Arowana Supreme Stick 125g',
//     category: 'Bio-Nutrition',
//     price: 520,
//     rating: 5.0,
//     reviews: 210,
//     badge: 'Apex Grade',
//     tag: 'Export Quality',
//     image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800',
//     description: 'High-density protein sticks loaded with krill meal, astaxanthin, and squid extract to promote spoon-head development and vibrant sheen.',
//     specs: ['Weight: 125g', 'High Digestibility', 'Rich in Omega 3 & 6', 'Prevents Drop Eye'],
//     popularFor: 'Asian Arowana, Silver Arowana'
//   },
//   {
//     id: 'p4',
//     name: 'Sun Conure & Avian Breeding Box',
//     category: 'Habitats & Cages',
//     price: 2450,
//     rating: 4.9,
//     reviews: 86,
//     badge: 'Handcrafted',
//     tag: 'Kerala Treated Teak',
//     image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&q=80&w=800',
//     description: 'Master craftsman crafted nest box measuring 58cm x 32cm. Heavy-duty non-toxic treated timber, interior climber safety wire mesh, lower utility handles.',
//     specs: ['Dimensions: 58cm x 32cm', 'Interior Metal Safety Mesh', '4 Stainless Lower Handles', 'Easy Clean Side Panel'],
//     popularFor: 'Sun Conures, Caiques, Small Cockatoos'
//   },
//   {
//     id: 'p5',
//     name: 'Natural Marine Pigment Color Boost',
//     category: 'Color Boosters',
//     price: 790,
//     rating: 4.7,
//     reviews: 62,
//     badge: 'Bio-Active',
//     tag: 'Concentrate',
//     image: 'https://images.unsplash.com/photo-1520315342629-6ea920342047?auto=format&fit=crop&q=80&w=800',
//     description: 'Super-concentrated bio-available astaxanthin powder treat for mixing into diets. Enhances deep reds, fiery oranges, and natural iridescent blues.',
//     specs: ['Net Weight: 80g', 'Natural Algae Derivative', 'Safe for Daily Use', 'Zero Hormones'],
//     popularFor: 'Flowerhorns, Red Discus, Marine Fauna'
//   },
//   {
//     id: 'p6',
//     name: 'Ultimate Carnivore Feast Bundle',
//     category: 'Value Bundles',
//     price: 1450,
//     rating: 5.0,
//     reviews: 310,
//     badge: 'Save 18%',
//     tag: 'Complete System',
//     image: 'https://images.unsplash.com/photo-1535591273668-578e31182c4f?auto=format&fit=crop&q=80&w=800',
//     description: 'The ultimate trio pack containing Freeze Dried Shrimp + Channa Stick 125g + Arowana Stick 125g. Complete nutritional coverage for top predators.',
//     specs: ['1x Freeze Dried Shrimp', '1x Channa Stick 125g', '1x Arowana Stick 125g', 'Free PËTIFY Sticker Pack'],
//     popularFor: 'Multi-Species Apex Aquariums'
//   }
// ];

// export default function App() {
//   // State
//   const [cart, setCart] = useState([]);
//   const [isCartOpen, setIsCartOpen] = useState(false);
//   const [selectedCategory, setSelectedCategory] = useState('All');
//   const [searchQuery, setSearchQuery] = useState('');
//   const [activeModalProduct, setActiveModalProduct] = useState(null);
//   const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

//   // Concierge Form State
//   const [conciergeStep, setConciergeStep] = useState(1);
//   const [conciergeAnimal, setConciergeAnimal] = useState('Predatory Aquatic');
//   const [conciergePackage, setConciergePackage] = useState('Bio-Nutrition Bundle');
//   const [conciergeNotes, setConciergeNotes] = useState('');

//   // Habitat Configurator State
//   const [habitatType, setHabitatType] = useState('Avian Breeding Box');
//   const [habitatWood, setHabitatWood] = useState('Kerala Hardwood (Weather-proof)');
//   const [habitatMesh, setHabitatMesh] = useState('Stainless Steel High-Grip');
//   const [habitatDimensions, setHabitatDimensions] = useState('58cm x 32cm x 32cm (Standard)');

//   // Cart helper functions
//   const addToCart = (product) => {
//     setCart((prevCart) => {
//       const existing = prevCart.find((item) => item.id === product.id);
//       if (existing) {
//         return prevCart.map((item) =>
//           item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
//         );
//       }
//       return [...prevCart, { ...product, quantity: 1 }];
//     });
//     setIsCartOpen(true);
//   };

//   const updateQuantity = (id, delta) => {
//     setCart((prevCart) =>
//       prevCart
//         .map((item) => {
//           if (item.id === id) {
//             const newQty = item.quantity + delta;
//             return newQty > 0 ? { ...item, quantity: newQty } : null;
//           }
//           return item;
//         })
//         .filter(Boolean)
//     );
//   };

//   const totalCartPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

//   // Generate WhatsApp Direct Link
//   const generateWhatsAppOrder = (itemDetails = null) => {
//     const phoneNumber = "919745001101";
//     let message = "";

//     if (itemDetails) {
//       message = `Hello PËTIFY Team Kerala! 👋\n\nI would like to order / inquire about: *${itemDetails.name}* (₹${itemDetails.price}).\n\nPlease confirm availability and payment details.`;
//     } else if (cart.length > 0) {
//       const cartSummary = cart.map((i) => `• ${i.name} x${i.quantity} (₹${i.price * i.quantity})`).join('\n');
//       message = `Hello PËTIFY Kerala! 🌿\n\nI would like to place an order from your website:\n\n*ORDER ITEMS:*\n${cartSummary}\n\n*TOTAL AMOUNT:* ₹${totalCartPrice}\n\nPlease confirm shipping & delivery timeline to my address.`;
//     } else {
//       message = `Hello PËTIFY! I am interested in your premium exotic pet diets and handcrafted enclosures. Please share your complete catalog.`;
//     }

//     return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
//   };

//   // Concierge WhatsApp Generator
//   const generateConciergeWhatsApp = () => {
//     const phoneNumber = "919745001101";
//     const text = `Hello PËTIFY Concierge! 🦜🐟\n\nI would like a custom setup package:\n• *Target Fauna:* ${conciergeAnimal}\n• *Desired Solution:* ${conciergePackage}\n• *Special Notes / Specs:* ${conciergeNotes || 'None'}\n\nPlease advise the best options and price quotation!`;
//     return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`;
//   };

//   // Configurator WhatsApp Generator
//   const generateConfiguratorWhatsApp = () => {
//     const phoneNumber = "919745001101";
//     const text = `Hello PËTIFY Habitat Workshop! 🪵🛠️\n\nI want a Custom Habitat Enclosure Quote:\n• *Type:* ${habitatType}\n• *Wood Finish:* ${habitatWood}\n• *Mesh Density:* ${habitatMesh}\n• *Dimensions:* ${habitatDimensions}\n\nPlease provide estimated time for handcrafting & total cost.`;
//     return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`;
//   };

//   // Filtered Products
//   const filteredProducts = PRODUCTS.filter((p) => {
//     const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
//     const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
//                           p.popularFor.toLowerCase().includes(searchQuery.toLowerCase());
//     return matchesCategory && matchesSearch;
//   });

//   return (
//     <div className="min-h-screen bg-[#F8FAFC] text-[#0B2545] font-sans selection:bg-[#10B981] selection:text-white antialiased">
      
//       {/* --- TOP BRANDING BANNER --- */}
//       <div className="bg-[#0B2545] text-white text-xs md:text-sm py-2 px-4 text-center font-medium flex items-center justify-center gap-2 border-b border-white/10">
//         <span className="bg-[#10B981] text-[#0B2545] text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full">Kerala Origin</span>
//         <span>🔥 Handcrafted Enclosures & Formulated Apex Diets Direct from Kerala, India.</span>
//         <a href="tel:+919745001101" className="underline hover:text-[#06B6D4] transition-colors hidden sm:inline ml-2">+91 97450 01101</a>
//       </div>

//       {/* --- STICKY NAVBAR --- */}
//       <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-slate-200/80 transition-all">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <div className="flex items-center justify-between h-20">
            
//             {/* Logo */}
//             <a href="#" className="flex items-center gap-3 group">
//               <div className="w-11 h-11 rounded-2xl bg-[#0B2545] flex items-center justify-center text-white shadow-lg shadow-[#0B2545]/20 group-hover:scale-105 transition-transform">
//                 <span className="text-xl font-black tracking-tighter text-[#10B981]">PË</span>
//               </div>
//               <div className="flex flex-col">
//                 <span className="text-2xl font-black tracking-tight text-[#0B2545] flex items-center gap-1">
//                   PËTIFY
//                   <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block"></span>
//                 </span>
//                 <span className="text-[10px] tracking-widest text-slate-500 font-semibold uppercase">Pure Love • Premium Care</span>
//               </div>
//             </a>

//             {/* Desktop Navigation Links */}
//             <nav className="hidden lg:flex items-center gap-8">
//               {['Bio-Nutrition', 'Habitats & Cages', 'Exotic Fauna', 'Value Bundles'].map((link) => {
//                 const catMap = {
//                   'Bio-Nutrition': 'Bio-Nutrition',
//                   'Habitats & Cages': 'Habitats & Cages',
//                   'Exotic Fauna': 'All',
//                   'Value Bundles': 'Value Bundles'
//                 };
//                 return (
//                   <button
//                     key={link}
//                     onClick={() => {
//                       setSelectedCategory(catMap[link] || 'All');
//                       document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
//                     }}
//                     className="text-sm font-semibold text-slate-700 hover:text-[#0B2545] relative py-1 transition-colors hover:after:w-full after:w-0 after:h-0.5 after:bg-[#10B981] after:absolute after:bottom-0 after:left-0 after:transition-all"
//                   >
//                     {link}
//                   </button>
//                 );
//               })}
//             </nav>

//             {/* Right Action CTAs */}
//             <div className="flex items-center gap-3">
//               {/* WhatsApp Quick Link */}
//               <a
//                 href={generateWhatsAppOrder()}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="hidden sm:flex items-center gap-2 bg-[#10B981] hover:bg-[#0ea5e9] text-white font-bold text-xs md:text-sm px-4 py-2.5 rounded-2xl shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0"
//               >
//                 <MessageCircle className="w-4 h-4 fill-current" />
//                 <span>WhatsApp Instant Order</span>
//               </a>

//               {/* Cart Drawer Button */}
//               <button
//                 onClick={() => setIsCartOpen(true)}
//                 className="relative p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-[#0B2545] transition-colors"
//                 aria-label="Open Shopping Cart"
//               >
//                 <ShoppingBag className="w-5 h-5" />
//                 {cart.length > 0 && (
//                   <span className="absolute -top-1 -right-1 bg-[#10B981] text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
//                     {cart.reduce((a, b) => a + b.quantity, 0)}
//                   </span>
//                 )}
//               </button>

//               {/* Mobile Menu Toggle */}
//               <button
//                 onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
//                 className="lg:hidden p-2.5 rounded-2xl bg-slate-100 text-slate-700 hover:text-[#0B2545]"
//               >
//                 {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* Mobile Navigation Dropdown */}
//         {mobileMenuOpen && (
//           <div className="lg:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 space-y-3">
//             <div className="flex flex-col space-y-2">
//               {['Bio-Nutrition', 'Habitats & Cages', 'Exotic Fauna', 'Value Bundles'].map((link) => (
//                 <button
//                   key={link}
//                   onClick={() => {
//                     setMobileMenuOpen(false);
//                     document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
//                   }}
//                   className="text-left py-2 px-3 rounded-xl hover:bg-slate-100 font-semibold text-slate-700"
//                 >
//                   {link}
//                 </button>
//               ))}
//             </div>
//             <a
//               href={generateWhatsAppOrder()}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="w-full flex items-center justify-center gap-2 bg-[#10B981] text-white font-bold py-3 rounded-xl"
//             >
//               <MessageCircle className="w-5 h-5" />
//               WhatsApp Direct (+91 97450 01101)
//             </a>
//           </div>
//         )}
//       </header>

//       {/* --- HERO SECTION --- */}
//       <section className="relative pt-8 pb-16 md:pt-16 md:pb-24 overflow-hidden">
//         {/* Background Decorative Elements */}
//         <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#06B6D4]/15 rounded-full filter blur-3xl pointer-events-none"></div>
//         <div className="absolute top-1/2 -right-20 w-96 h-96 bg-[#10B981]/15 rounded-full filter blur-3xl pointer-events-none"></div>

//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
//           <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
//             {/* Left Column Text & CTAs */}
//             <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              
//               <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 border border-slate-200/80 text-[#0B2545] text-xs md:text-sm font-semibold">
//                 <Sparkles className="w-4 h-4 text-[#F59E0B]" />
//                 <span>Kerala’s Premier Exotic Fauna & Care Atelier</span>
//               </div>

//               <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#0B2545] tracking-tight leading-[1.15]">
//                 Pure Love, <br className="hidden sm:inline" />
//                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0B2545] via-[#06B6D4] to-[#10B981]">
//                   Premium Care
//                 </span> <br />
//                 for the Extraordinary.
//               </h1>

//               <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto lg:mx-0 leading-relaxed">
//                 Formulated bio-diets for apex predators, heavy-duty handcrafted wood habitats, and direct expert consultation rooted in Kerala, India.
//               </p>

//               {/* Dual CTAs */}
//               <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
//                 <button
//                   onClick={() => {
//                     document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
//                   }}
//                   className="w-full sm:w-auto bg-[#0B2545] hover:bg-[#153a66] text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-[#0B2545]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
//                 >
//                   <Fish className="w-5 h-5 text-[#10B981]" />
//                   <span>Explore Bio-Nutrition</span>
//                 </button>

//                 <button
//                   onClick={() => setIsConfiguratorOpen(true)}
//                   className="w-full sm:w-auto bg-white hover:bg-slate-50 text-[#0B2545] font-bold px-8 py-4 rounded-2xl border border-slate-300 shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
//                 >
//                   <Box className="w-5 h-5 text-[#06B6D4]" />
//                   <span>Custom Habitat Inquiry</span>
//                 </button>
//               </div>

//               {/* Floating Glass Badges Container */}
//               <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto lg:mx-0">
//                 <div className="backdrop-blur-md bg-white/70 border border-slate-200/80 p-3.5 rounded-2xl shadow-sm flex items-center gap-3">
//                   <div className="w-8 h-8 rounded-xl bg-cyan-100 text-[#06B6D4] flex items-center justify-center shrink-0">
//                     <ShieldCheck className="w-4 h-4" />
//                   </div>
//                   <div className="text-left">
//                     <div className="text-xs font-bold text-[#0B2545]">Clean-Water Formula</div>
//                     <div className="text-[11px] text-slate-500">Zero water clouding</div>
//                   </div>
//                 </div>

//                 <div className="backdrop-blur-md bg-white/70 border border-slate-200/80 p-3.5 rounded-2xl shadow-sm flex items-center gap-3">
//                   <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#10B981] flex items-center justify-center shrink-0">
//                     <Award className="w-4 h-4" />
//                   </div>
//                   <div className="text-left">
//                     <div className="text-xs font-bold text-[#0B2545]">Treated Hardwood</div>
//                     <div className="text-[11px] text-slate-500">Rot & pest resistant</div>
//                   </div>
//                 </div>

//                 <div className="backdrop-blur-md bg-white/70 border border-slate-200/80 p-3.5 rounded-2xl shadow-sm flex items-center gap-3">
//                   <div className="w-8 h-8 rounded-xl bg-amber-100 text-[#F59E0B] flex items-center justify-center shrink-0">
//                     <Zap className="w-4 h-4" />
//                   </div>
//                   <div className="text-left">
//                     <div className="text-xs font-bold text-[#0B2545]">Direct Breeder Support</div>
//                     <div className="text-[11px] text-slate-500">Kerala vet assistance</div>
//                   </div>
//                 </div>
//               </div>

//             </div>

//             {/* Right Column Visual Showcase */}
//             <div className="lg:col-span-5 relative">
//               <div className="relative mx-auto max-w-md lg:max-w-none">
                
//                 {/* Main Hero Card Image Showcase */}
//                 <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-slate-900 group">
//                   <img
//                     src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=1000"
//                     alt="Arowana & Exotic Fish Bio Diet"
//                     className="w-full h-[420px] object-cover group-hover:scale-105 transition-transform duration-700 opacity-90"
//                   />
//                   <div className="absolute inset-0 bg-gradient-to-t from-[#0B2545] via-transparent to-transparent opacity-80"></div>
                  
//                   {/* Floating Badge on Image */}
//                   <div className="absolute top-4 right-4 backdrop-blur-md bg-black/40 text-white border border-white/20 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
//                     <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping"></span>
//                     <span>Hand-Formulated Batch</span>
//                   </div>

//                   {/* Bottom Text Overlay */}
//                   <div className="absolute bottom-6 left-6 right-6 text-white space-y-1">
//                     <span className="text-xs font-bold uppercase tracking-wider text-[#10B981]">Featured Apex Bio-Diet</span>
//                     <h3 className="text-xl font-bold">Arowana & Channa Color Boosters</h3>
//                     <p className="text-xs text-slate-300">Rich in natural spirulina, crude protein & pigments for deep hue vibrance.</p>
//                   </div>
//                 </div>

//                 {/* Secondary Floating Glass Card */}
//                 <div className="absolute -bottom-6 -left-6 backdrop-blur-xl bg-white/90 border border-white/50 p-4 rounded-2xl shadow-xl max-w-xs hidden sm:flex items-center gap-4">
//                   <div className="w-12 h-12 rounded-xl bg-[#0B2545] text-[#10B981] flex items-center justify-center shrink-0">
//                     <Bird className="w-6 h-6" />
//                   </div>
//                   <div>
//                     <div className="text-xs font-extrabold text-[#0B2545]">Sun Conure Breeding Box</div>
//                     <div className="text-[11px] text-slate-500 font-medium">58cm x 32cm Heavy-duty Timber</div>
//                     <div className="text-[11px] text-[#10B981] font-bold mt-0.5">₹2,450 • In Stock</div>
//                   </div>
//                 </div>

//               </div>
//             </div>

//           </div>
//         </div>

//         {/* Trust Strip */}
//         <div className="mt-12 border-y border-slate-200/80 bg-white/60 backdrop-blur-md py-4">
//           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//             <div className="flex flex-wrap items-center justify-around gap-6 text-slate-600 text-xs font-bold uppercase tracking-wider">
//               <div className="flex items-center gap-2">
//                 <MapPin className="w-4 h-4 text-[#10B981]" />
//                 <span>Crafted in Kerala, India</span>
//               </div>
//               <div className="flex items-center gap-2">
//                 <CheckCircle2 className="w-4 h-4 text-[#06B6D4]" />
//                 <span>100% Non-Toxic Organic Wood</span>
//               </div>
//               <div className="flex items-center gap-2">
//                 <Award className="w-4 h-4 text-[#F59E0B]" />
//                 <span>Exotic Breeder Tested</span>
//               </div>
//               <div className="flex items-center gap-2">
//                 <MessageCircle className="w-4 h-4 text-[#10B981]" />
//                 <span>Direct WhatsApp Consultation</span>
//               </div>
//             </div>
//           </div>
//         </div>
//       </section>

//       {/* --- FEATURED CATEGORIES (INTERACTIVE GRID) --- */}
//       <section className="py-16 bg-white">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
//           <div className="text-center max-w-2xl mx-auto space-y-2">
//             <h2 className="text-xs font-bold uppercase tracking-widest text-[#10B981]">Care Solutions</h2>
//             <p className="text-3xl font-black text-[#0B2545]">PËTIFY Core Offerings</p>
//             <p className="text-slate-600 text-sm">Designed specifically for predatory aquatic species, exotic birds, and specialized habitat requirements.</p>
//           </div>

//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
//             {/* Category Card 1 */}
//             <div className="group rounded-3xl p-6 bg-slate-50 border border-slate-200/80 hover:border-[#10B981]/50 hover:shadow-xl transition-all duration-300 relative flex flex-col justify-between">
//               <div className="space-y-4">
//                 <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#10B981] flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform">
//                   <Fish className="w-6 h-6" />
//                 </div>
//                 <div>
//                   <h3 className="text-lg font-bold text-[#0B2545]">High-Protein Bio-Nutrition</h3>
//                   <p className="text-xs text-slate-500 mt-1 leading-relaxed">
//                     Freeze Dried Shrimp, Channa Sticks & Arowana Formulas packed with 60%+ crude protein.
//                   </p>
//                 </div>
//               </div>
//               <button 
//                 onClick={() => {
//                   setSelectedCategory('Bio-Nutrition');
//                   document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
//                 }}
//                 className="mt-6 flex items-center gap-1 text-xs font-bold text-[#10B981] group-hover:gap-2 transition-all"
//               >
//                 <span>Browse Diets</span>
//                 <ChevronRight className="w-4 h-4" />
//               </button>
//             </div>

//             {/* Category Card 2 */}
//             <div className="group rounded-3xl p-6 bg-slate-50 border border-slate-200/80 hover:border-[#06B6D4]/50 hover:shadow-xl transition-all duration-300 relative flex flex-col justify-between">
//               <div className="space-y-4">
//                 <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-[#06B6D4] flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform">
//                   <Box className="w-6 h-6" />
//                 </div>
//                 <div>
//                   <h3 className="text-lg font-bold text-[#0B2545]">Handcrafted Habitats</h3>
//                   <p className="text-xs text-slate-500 mt-1 leading-relaxed">
//                     Custom Avian Breeding Boxes (58x32cm) with interior safety climbing mesh & lower handles.
//                   </p>
//                 </div>
//               </div>
//               <button 
//                 onClick={() => {
//                   setSelectedCategory('Habitats & Cages');
//                   document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
//                 }}
//                 className="mt-6 flex items-center gap-1 text-xs font-bold text-[#06B6D4] group-hover:gap-2 transition-all"
//               >
//                 <span>Explore Enclosures</span>
//                 <ChevronRight className="w-4 h-4" />
//               </button>
//             </div>

//             {/* Category Card 3 */}
//             <div className="group rounded-3xl p-6 bg-slate-50 border border-slate-200/80 hover:border-[#F59E0B]/50 hover:shadow-xl transition-all duration-300 relative flex flex-col justify-between">
//               <div className="space-y-4">
//                 <div className="w-12 h-12 rounded-2xl bg-amber-100 text-[#F59E0B] flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform">
//                   <Sparkles className="w-6 h-6" />
//                 </div>
//                 <div>
//                   <h3 className="text-lg font-bold text-[#0B2545]">Color Boosters</h3>
//                   <p className="text-xs text-slate-500 mt-1 leading-relaxed">
//                     Natural marine pigment extracts & astaxanthin concentrates for vibrant skin & scale hue.
//                   </p>
//                 </div>
//               </div>
//               <button 
//                 onClick={() => {
//                   setSelectedCategory('Color Boosters');
//                   document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
//                 }}
//                 className="mt-6 flex items-center gap-1 text-xs font-bold text-[#F59E0B] group-hover:gap-2 transition-all"
//               >
//                 <span>View Boosters</span>
//                 <ChevronRight className="w-4 h-4" />
//               </button>
//             </div>

//             {/* Category Card 4 */}
//             <div className="group rounded-3xl p-6 bg-slate-50 border border-slate-200/80 hover:border-[#0B2545]/50 hover:shadow-xl transition-all duration-300 relative flex flex-col justify-between">
//               <div className="space-y-4">
//                 <div className="w-12 h-12 rounded-2xl bg-slate-200 text-[#0B2545] flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform">
//                   <Layers className="w-6 h-6" />
//                 </div>
//                 <div>
//                   <h3 className="text-lg font-bold text-[#0B2545]">Value Combo Bundles</h3>
//                   <p className="text-xs text-slate-500 mt-1 leading-relaxed">
//                     Curated staple feed + treat pairings packed together at exclusive discount savings.
//                   </p>
//                 </div>
//               </div>
//               <button 
//                 onClick={() => {
//                   setSelectedCategory('Value Bundles');
//                   document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
//                 }}
//                 className="mt-6 flex items-center gap-1 text-xs font-bold text-[#0B2545] group-hover:gap-2 transition-all"
//               >
//                 <span>See Bundles</span>
//                 <ChevronRight className="w-4 h-4" />
//               </button>
//             </div>

//           </div>
//         </div>
//       </section>

//       {/* --- DYNAMIC CATALOG & PRODUCT SHOWCASE WITH FILTERS --- */}
//       <section id="catalog-section" className="py-16 bg-[#F8FAFC]">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
//           {/* Header & Search */}
//           <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
//             <div>
//               <span className="text-xs font-bold uppercase tracking-widest text-[#10B981]">Exotic Atelier Catalog</span>
//               <h2 className="text-3xl font-black text-[#0B2545]">Formulated Diets & Crafts</h2>
//             </div>

//             {/* Search Input */}
//             <div className="relative w-full md:w-72">
//               <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
//               <input
//                 type="text"
//                 placeholder="Search Arowana, Conure, Shrimp..."
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#10B981] shadow-sm"
//               />
//               {searchQuery && (
//                 <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
//                   <X className="w-3.5 h-3.5" />
//                 </button>
//               )}
//             </div>
//           </div>

//           {/* Category Filter Pills */}
//           <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
//             {['All', 'Bio-Nutrition', 'Habitats & Cages', 'Color Boosters', 'Value Bundles'].map((cat) => (
//               <button
//                 key={cat}
//                 onClick={() => setSelectedCategory(cat)}
//                 className={`px-5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
//                   selectedCategory === cat
//                     ? 'bg-[#0B2545] text-white shadow-md'
//                     : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
//                 }`}
//               >
//                 {cat}
//               </button>
//             ))}
//           </div>

//           {/* Product Cards Grid */}
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
//             {filteredProducts.map((product) => (
//               <div
//                 key={product.id}
//                 className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all duration-300 flex flex-col justify-between group"
//               >
//                 <div>
//                   {/* Image Container */}
//                   <div className="relative h-60 overflow-hidden bg-slate-100">
//                     <img
//                       src={product.image}
//                       alt={product.name}
//                       className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
//                     />
//                     <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
//                       <span className="bg-[#0B2545] text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-xl backdrop-blur-md">
//                         {product.badge}
//                       </span>
//                       <span className="bg-[#10B981] text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-xl">
//                         {product.tag}
//                       </span>
//                     </div>

//                     {/* Quick View trigger button */}
//                     <button
//                       onClick={() => setActiveModalProduct(product)}
//                       className="absolute bottom-3 right-3 bg-white/90 hover:bg-white text-[#0B2545] text-xs font-bold px-3 py-1.5 rounded-xl shadow backdrop-blur-md flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
//                     >
//                       <Info className="w-3.5 h-3.5 text-[#06B6D4]" />
//                       <span>Quick Specs</span>
//                     </button>
//                   </div>

//                   {/* Card Content */}
//                   <div className="p-6 space-y-3">
//                     <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
//                       <span>{product.category}</span>
//                       <div className="flex items-center gap-1 text-amber-500">
//                         <span>★</span>
//                         <span className="text-slate-700 font-bold">{product.rating}</span>
//                         <span className="text-slate-400">({product.reviews})</span>
//                       </div>
//                     </div>

//                     <h3 className="text-lg font-extrabold text-[#0B2545] group-hover:text-[#10B981] transition-colors">
//                       {product.name}
//                     </h3>

//                     <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
//                       {product.description}
//                     </p>

//                     <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1">
//                       <div className="text-[10px] uppercase font-bold text-slate-400">Suitable For:</div>
//                       <div className="text-xs font-semibold text-[#0B2545]">{product.popularFor}</div>
//                     </div>
//                   </div>
//                 </div>

//                 {/* Footer Price & Add to Cart Action */}
//                 <div className="p-6 pt-0 space-y-3">
//                   <div className="flex items-center justify-between pt-2 border-t border-slate-100">
//                     <div>
//                       <div className="text-[10px] text-slate-400 font-bold uppercase">Price</div>
//                       <div className="text-xl font-black text-[#0B2545]">₹{product.price}</div>
//                     </div>

//                     <button
//                       onClick={() => addToCart(product)}
//                       className="bg-[#0B2545] hover:bg-[#10B981] text-white font-bold text-xs px-4 py-2.5 rounded-2xl shadow transition-colors flex items-center gap-2"
//                     >
//                       <ShoppingBag className="w-4 h-4" />
//                       <span>Add to Cart</span>
//                     </button>
//                   </div>

//                   {/* WhatsApp Direct Order Single Button */}
//                   <a
//                     href={generateWhatsAppOrder(product)}
//                     target="_blank"
//                     rel="noopener noreferrer"
//                     className="w-full py-2 rounded-xl border border-emerald-200 text-[#10B981] hover:bg-emerald-50 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
//                   >
//                     <MessageCircle className="w-3.5 h-3.5 fill-current" />
//                     <span>Instant WhatsApp Order</span>
//                   </a>
//                 </div>
//               </div>
//             ))}
//           </div>

//           {filteredProducts.length === 0 && (
//             <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
//               <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
//               <h3 className="text-lg font-bold text-[#0B2545]">No matching products found</h3>
//               <p className="text-xs text-slate-500 mt-1">Try clearing your search query or selecting another category.</p>
//               <button
//                 onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}
//                 className="mt-4 bg-[#0B2545] text-white text-xs font-bold px-4 py-2 rounded-xl"
//               >
//                 Reset Filters
//               </button>
//             </div>
//           )}

//         </div>
//       </section>

//       {/* --- INTERACTIVE WHATSAPP CONCIERGE WORKFLOW --- */}
//       <section className="py-20 bg-[#0B2545] text-white relative overflow-hidden">
//         {/* Glow Effects */}
//         <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#10B981]/20 rounded-full filter blur-3xl pointer-events-none"></div>
//         <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#06B6D4]/20 rounded-full filter blur-3xl pointer-events-none"></div>

//         <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-10">
          
//           <div className="text-center max-w-2xl mx-auto space-y-3">
//             <span className="bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 text-xs font-extrabold uppercase px-3.5 py-1 rounded-full inline-block">
//               Tailored Kerala Concierge
//             </span>
//             <h2 className="text-3xl sm:text-4xl font-black">Configure Custom WhatsApp Order</h2>
//             <p className="text-slate-300 text-sm">
//               Not sure which diet or cage fits your species? Select your setup parameters below to automatically format a WhatsApp request to our experts.
//             </p>
//           </div>

//           {/* Interactive Stepper Card */}
//           <div className="backdrop-blur-xl bg-white/10 border border-white/15 p-6 sm:p-10 rounded-3xl shadow-2xl space-y-8">
            
//             {/* Step Indicators */}
//             <div className="grid grid-cols-3 gap-2 border-b border-white/10 pb-6">
//               {[
//                 { step: 1, title: '1. Animal Category' },
//                 { step: 2, title: '2. Solution Package' },
//                 { step: 3, title: '3. Species Notes & Send' }
//               ].map((s) => (
//                 <button
//                   key={s.step}
//                   onClick={() => setConciergeStep(s.step)}
//                   className={`text-left text-xs sm:text-sm font-bold pb-2 transition-all border-b-2 ${
//                     conciergeStep === s.step
//                       ? 'border-[#10B981] text-[#10B981]'
//                       : 'border-transparent text-slate-400 hover:text-white'
//                   }`}
//                 >
//                   {s.title}
//                 </button>
//               ))}
//             </div>

//             {/* STEP 1: Animal Category */}
//             {conciergeStep === 1 && (
//               <div className="space-y-4 animate-fadeIn">
//                 <label className="text-sm font-bold text-slate-200">Select Fauna Category:</label>
//                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//                   {[
//                     { title: 'Predatory Aquatic', desc: 'Arowana, Channa, Snakeheads, Cichlids', icon: Fish },
//                     { title: 'Avian & Birds', desc: 'Sun Conures, Parrots, Macaws, Finches', icon: Bird },
//                     { title: 'Exotic Small Mammal', desc: 'Sugar Gliders, Hedgehogs, Reptiles', icon: Heart }
//                   ].map((cat) => {
//                     const Icon = cat.icon;
//                     return (
//                       <div
//                         key={cat.title}
//                         onClick={() => setConciergeAnimal(cat.title)}
//                         className={`p-5 rounded-2xl cursor-pointer border transition-all ${
//                           conciergeAnimal === cat.title
//                             ? 'bg-[#10B981]/20 border-[#10B981] text-white shadow-lg'
//                             : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
//                         }`}
//                       >
//                         <Icon className="w-8 h-8 text-[#10B981] mb-3" />
//                         <div className="font-extrabold text-sm">{cat.title}</div>
//                         <div className="text-xs text-slate-400 mt-1">{cat.desc}</div>
//                       </div>
//                     );
//                   })}
//                 </div>
                
//                 <div className="flex justify-end pt-4">
//                   <button
//                     onClick={() => setConciergeStep(2)}
//                     className="bg-[#10B981] hover:bg-[#0ea5e9] text-white font-bold text-xs px-6 py-3 rounded-2xl flex items-center gap-2 transition-colors"
//                   >
//                     <span>Next: Solution Package</span>
//                     <ArrowRight className="w-4 h-4" />
//                   </button>
//                 </div>
//               </div>
//             )}

//             {/* STEP 2: Package Type */}
//             {conciergeStep === 2 && (
//               <div className="space-y-4 animate-fadeIn">
//                 <label className="text-sm font-bold text-slate-200">Select Desired Package:</label>
//                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//                   {[
//                     'Bio-Nutrition Bundle (Shrimp + Pellets)',
//                     'Handcrafted Breeding Enclosure / Box',
//                     'Color Boosting & Pigment Supplement Pack',
//                     'Full Ecosystem / Breeder Starter Kit'
//                   ].map((pkg) => (
//                     <div
//                       key={pkg}
//                       onClick={() => setConciergePackage(pkg)}
//                       className={`p-5 rounded-2xl cursor-pointer border transition-all flex items-center justify-between ${
//                         conciergePackage === pkg
//                           ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-white'
//                           : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
//                       }`}
//                     >
//                       <span className="font-bold text-xs sm:text-sm">{pkg}</span>
//                       {conciergePackage === pkg && <Check className="w-5 h-5 text-[#06B6D4]" />}
//                     </div>
//                   ))}
//                 </div>

//                 <div className="flex justify-between pt-4">
//                   <button
//                     onClick={() => setConciergeStep(1)}
//                     className="bg-white/10 text-white font-bold text-xs px-6 py-3 rounded-2xl hover:bg-white/20"
//                   >
//                     Back
//                   </button>
//                   <button
//                     onClick={() => setConciergeStep(3)}
//                     className="bg-[#10B981] hover:bg-[#0ea5e9] text-white font-bold text-xs px-6 py-3 rounded-2xl flex items-center gap-2"
//                   >
//                     <span>Next: Custom Notes</span>
//                     <ArrowRight className="w-4 h-4" />
//                   </button>
//                 </div>
//               </div>
//             )}

//             {/* STEP 3: Notes & WhatsApp Generate */}
//             {conciergeStep === 3 && (
//               <div className="space-y-4 animate-fadeIn">
//                 <div className="space-y-2">
//                   <label className="text-sm font-bold text-slate-200">Species Details / Tank Size / Custom Dimensions:</label>
//                   <textarea
//                     rows={3}
//                     placeholder="e.g. I have a 2-year old Sun Conure pair and need a breeding box with specific front door latch..."
//                     value={conciergeNotes}
//                     onChange={(e) => setConciergeNotes(e.target.value)}
//                     className="w-full bg-white/10 border border-white/20 rounded-2xl p-4 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#10B981]"
//                   ></textarea>
//                 </div>

//                 {/* Summary View */}
//                 <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs space-y-1 text-slate-300">
//                   <div className="font-bold text-white mb-2 uppercase text-[10px] tracking-wider text-[#10B981]">Order Preview Summary</div>
//                   <div>• Category: <span className="text-white font-semibold">{conciergeAnimal}</span></div>
//                   <div>• Package: <span className="text-white font-semibold">{conciergePackage}</span></div>
//                   <div>• Notes: <span className="text-white font-semibold">{conciergeNotes || 'None'}</span></div>
//                 </div>

//                 <div className="flex justify-between pt-4">
//                   <button
//                     onClick={() => setConciergeStep(2)}
//                     className="bg-white/10 text-white font-bold text-xs px-6 py-3 rounded-2xl hover:bg-white/20"
//                   >
//                     Back
//                   </button>

//                   <a
//                     href={generateConciergeWhatsApp()}
//                     target="_blank"
//                     rel="noopener noreferrer"
//                     className="bg-[#10B981] hover:bg-[#0ea5e9] text-white font-black text-xs sm:text-sm px-8 py-3.5 rounded-2xl shadow-xl flex items-center gap-2 transition-transform hover:scale-105"
//                   >
//                     <MessageCircle className="w-5 h-5 fill-current" />
//                     <span>Send Order via WhatsApp (+91 97450 01101)</span>
//                   </a>
//                 </div>
//               </div>
//             )}

//           </div>

//         </div>
//       </section>

//       {/* --- CUSTOM HABITAT ENCLOSURE CONFIGURATOR MODAL / SECTION --- */}
//       <section className="py-16 bg-white border-t border-slate-200">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <div className="bg-gradient-to-br from-slate-900 to-[#0B2545] rounded-3xl p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden">
            
//             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
//               <div className="lg:col-span-7 space-y-4">
//                 <span className="bg-[#06B6D4] text-[#0B2545] text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full">
//                   Crafted Wood Workshop
//                 </span>
//                 <h2 className="text-3xl sm:text-4xl font-black">Custom Wood Habitat Workshop</h2>
//                 <p className="text-slate-300 text-sm leading-relaxed">
//                   Every bird & reptile environment is built in Kerala using treated rot-free timber, heavy-duty interior safety mesh, and double lower handle grips. Custom dimensions built to order.
//                 </p>

//                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
//                   <div className="p-3 bg-white/10 rounded-2xl border border-white/10">
//                     <div className="text-[#10B981] font-bold">58cm x 32cm</div>
//                     <div className="text-slate-400 text-[10px]">Standard Conure Box</div>
//                   </div>
//                   <div className="p-3 bg-white/10 rounded-2xl border border-white/10">
//                     <div className="text-[#06B6D4] font-bold">Lower 4 Handles</div>
//                     <div className="text-slate-400 text-[10px]">Easy transport grips</div>
//                   </div>
//                   <div className="p-3 bg-white/10 rounded-2xl border border-white/10">
//                     <div className="text-[#F59E0B] font-bold">Internal Mesh</div>
//                     <div className="text-slate-400 text-[10px]">Safe claw climb wire</div>
//                   </div>
//                 </div>
//               </div>

//               <div className="lg:col-span-5 flex justify-center lg:justify-end">
//                 <button
//                   onClick={() => setIsConfiguratorOpen(true)}
//                   className="w-full sm:w-auto bg-[#10B981] hover:bg-[#0ea5e9] text-white font-extrabold text-sm px-8 py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-transform hover:scale-105"
//                 >
//                   <Sliders className="w-5 h-5" />
//                   <span>Launch Custom Configurator</span>
//                 </button>
//               </div>
//             </div>

//           </div>
//         </div>
//       </section>

//       {/* --- KERALA SANCTUARY & ETHICAL COMMITMENT FOOTER --- */}
//       <footer className="bg-[#0B2545] text-white pt-16 pb-12 border-t border-white/10">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            
//             {/* Brand Info */}
//             <div className="lg:col-span-2 space-y-4">
//               <div className="flex items-center gap-3">
//                 <div className="w-10 h-10 rounded-2xl bg-[#10B981] text-[#0B2545] flex items-center justify-center font-black text-xl">
//                   PË
//                 </div>
//                 <span className="text-2xl font-black tracking-tight">PËTIFY</span>
//               </div>

//               <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
//                 Kerala’s premier exotic fauna care brand. Dedicated to providing formulated bio-diets, high-protein natural treats, and handcrafted non-toxic avian & aquatic enclosures.
//               </p>

//               <div className="space-y-2 text-xs text-slate-300">
//                 <div className="flex items-center gap-2">
//                   <MapPin className="w-4 h-4 text-[#10B981]" />
//                   <span>Kerala, India • Direct Breeder Atelier</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <Phone className="w-4 h-4 text-[#06B6D4]" />
//                   <a href="tel:+919745001101" className="hover:underline">+91 97450 01101</a>
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <Mail className="w-4 h-4 text-[#F59E0B]" />
//                   <a href="mailto:petify.shopping@gmail.com" className="hover:underline">petify.shopping@gmail.com</a>
//                 </div>
//               </div>
//             </div>

//             {/* Quick Links */}
//             <div className="space-y-3">
//               <h4 className="text-xs font-bold uppercase tracking-wider text-[#10B981]">Products</h4>
//               <ul className="space-y-2 text-xs text-slate-300">
//                 <li><a href="#catalog-section" className="hover:text-white transition-colors">Freeze Dried Shrimp</a></li>
//                 <li><a href="#catalog-section" className="hover:text-white transition-colors">Channa Stick 125g</a></li>
//                 <li><a href="#catalog-section" className="hover:text-white transition-colors">Arowana Supreme 125g</a></li>
//                 <li><a href="#catalog-section" className="hover:text-white transition-colors">Sun Conure Nest Box</a></li>
//                 <li><a href="#catalog-section" className="hover:text-white transition-colors">Color Booster Astaxanthin</a></li>
//               </ul>
//             </div>

//             {/* Care & Ethical */}
//             <div className="space-y-3">
//               <h4 className="text-xs font-bold uppercase tracking-wider text-[#06B6D4]">Breeder Care</h4>
//               <ul className="space-y-2 text-xs text-slate-300">
//                 <li><a href="#" className="hover:text-white transition-colors">Vet-Formulated Standards</a></li>
//                 <li><a href="#" className="hover:text-white transition-colors">Non-Toxic Wood Treatment</a></li>
//                 <li><a href="#" className="hover:text-white transition-colors">Clean Water Guarantee</a></li>
//                 <li><a href="#" className="hover:text-white transition-colors">Kerala Shipping Dispatch</a></li>
//               </ul>
//             </div>

//             {/* Newsletter */}
//             <div className="space-y-3">
//               <h4 className="text-xs font-bold uppercase tracking-wider text-[#F59E0B]">Kerala Breeder Club</h4>
//               <p className="text-xs text-slate-300">Join our WhatsApp alert list for seasonal fresh shrimp batches and cage releases.</p>
              
//               <a
//                 href={generateWhatsAppOrder()}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="w-full bg-[#10B981] hover:bg-[#0ea5e9] text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors inline-block text-center"
//               >
//                 <MessageCircle className="w-4 h-4 fill-current inline" />
//                 <span>Join WhatsApp Updates</span>
//               </a>
//             </div>

//           </div>

//           <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
//             <div>
//               © 2026 PËTIFY Exotic Pet Care Kerala. All rights reserved.
//             </div>
//             <div className="flex items-center gap-6">
//               <span className="hover:text-white cursor-pointer">Privacy Policy</span>
//               <span className="hover:text-white cursor-pointer">Breeder Guidelines</span>
//               <span className="hover:text-white cursor-pointer">Terms of Service</span>
//             </div>
//           </div>

//         </div>
//       </footer>

//       {/* --- PRODUCT QUICK VIEW MODAL --- */}
//       {activeModalProduct && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
//           <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative border border-slate-100">
            
//             <button
//               onClick={() => setActiveModalProduct(null)}
//               className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full bg-slate-100"
//             >
//               <X className="w-5 h-5" />
//             </button>

//             <div className="flex items-center gap-4">
//               <img
//                 src={activeModalProduct.image}
//                 alt={activeModalProduct.name}
//                 className="w-20 h-20 rounded-2xl object-cover"
//               />
//               <div>
//                 <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider">{activeModalProduct.category}</span>
//                 <h3 className="text-lg font-black text-[#0B2545]">{activeModalProduct.name}</h3>
//                 <div className="text-base font-extrabold text-[#0B2545] mt-1">₹{activeModalProduct.price}</div>
//               </div>
//             </div>

//             <p className="text-xs text-slate-600 leading-relaxed">
//               {activeModalProduct.description}
//             </p>

//             <div className="space-y-2">
//               <h4 className="text-xs font-bold text-[#0B2545] uppercase tracking-wider">Key Specifications & Features:</h4>
//               <ul className="grid grid-cols-1 gap-1.5 text-xs text-slate-600">
//                 {activeModalProduct.specs.map((spec, idx) => (
//                   <li key={idx} className="flex items-center gap-2">
//                     <Check className="w-4 h-4 text-[#10B981]" />
//                     <span>{spec}</span>
//                   </li>
//                 ))}
//               </ul>
//             </div>

//             <div className="pt-2 flex gap-3">
//               <button
//                 onClick={() => {
//                   addToCart(activeModalProduct);
//                   setActiveModalProduct(null);
//                 }}
//                 className="flex-1 bg-[#0B2545] hover:bg-[#10B981] text-white font-bold text-xs py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
//               >
//                 <ShoppingBag className="w-4 h-4" />
//                 <span>Add to Cart</span>
//               </button>

//               <a
//                 href={generateWhatsAppOrder(activeModalProduct)}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="flex-1 bg-[#10B981] hover:bg-[#0ea5e9] text-white font-bold text-xs py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 text-center"
//               >
//                 <MessageCircle className="w-4 h-4 fill-current" />
//                 <span>Order WhatsApp</span>
//               </a>
//             </div>

//           </div>
//         </div>
//       )}

//       {/* --- CUSTOM HABITAT CONFIGURATOR MODAL --- */}
//       {isConfiguratorOpen && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
//           <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative border border-slate-100 max-h-[90vh] overflow-y-auto">
            
//             <button
//               onClick={() => setIsConfiguratorOpen(false)}
//               className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full bg-slate-100"
//             >
//               <X className="w-5 h-5" />
//             </button>

//             <div className="space-y-1">
//               <span className="text-[10px] font-bold text-[#06B6D4] uppercase tracking-wider">Interactive Builder</span>
//               <h3 className="text-xl font-black text-[#0B2545]">Configure Custom Enclosure</h3>
//               <p className="text-xs text-slate-500">Specify timber treatments, dimensions and safety mesh options.</p>
//             </div>

//             <div className="space-y-4">
              
//               <div>
//                 <label className="text-xs font-bold text-slate-700 block mb-1">Enclosure Type:</label>
//                 <select
//                   value={habitatType}
//                   onChange={(e) => setHabitatType(e.target.value)}
//                   className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-[#0B2545]"
//                 >
//                   <option>Sun Conure & Avian Breeding Box</option>
//                   <option>XL Macaw & Aviary Box</option>
//                   <option>Paludarium Wood Canopy Enclosure</option>
//                   <option>Reptile & Small Mammal Habitat</option>
//                 </select>
//               </div>

//               <div>
//                 <label className="text-xs font-bold text-slate-700 block mb-1">Wood Material Finish:</label>
//                 <select
//                   value={habitatWood}
//                   onChange={(e) => setHabitatWood(e.target.value)}
//                   className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-[#0B2545]"
//                 >
//                   <option>Kerala Hardwood (Weather-proof / Non-toxic)</option>
//                   <option>Organic Teak Wood (Premium Grade)</option>
//                   <option>Untreated Natural Birch Wood</option>
//                 </select>
//               </div>

//               <div>
//                 <label className="text-xs font-bold text-slate-700 block mb-1">Interior Safety Mesh:</label>
//                 <select
//                   value={habitatMesh}
//                   onChange={(e) => setHabitatMesh(e.target.value)}
//                   className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-[#0B2545]"
//                 >
//                   <option>Stainless Steel High-Grip Safety Climbing Wire</option>
//                   <option>Heavy-Duty Coated Steel Mesh</option>
//                   <option>Smooth Interior Non-Mesh Panel</option>
//                 </select>
//               </div>

//               <div>
//                 <label className="text-xs font-bold text-slate-700 block mb-1">Custom Dimensions:</label>
//                 <input
//                   type="text"
//                   value={habitatDimensions}
//                   onChange={(e) => setHabitatDimensions(e.target.value)}
//                   className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-[#0B2545]"
//                   placeholder="e.g. 58cm x 32cm x 32cm"
//                 />
//               </div>

//             </div>

//             <div className="pt-2">
//               <a
//                 href={generateConfiguratorWhatsApp()}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="w-full bg-[#10B981] hover:bg-[#0ea5e9] text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-colors text-center"
//               >
//                 <MessageCircle className="w-4 h-4 fill-current" />
//                 <span>Submit Custom Inquiry via WhatsApp (+91 97450 01101)</span>
//               </a>
//             </div>

//           </div>
//         </div>
//       )}

//       {/* --- CART SLIDE-OVER DRAWER --- */}
//       {isCartOpen && (
//         <div className="fixed inset-0 z-50 overflow-hidden">
//           <div className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={() => setIsCartOpen(false)}></div>

//           <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
//             <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
              
//               {/* Cart Header */}
//               <div className="p-6 border-b border-slate-100 flex items-center justify-between">
//                 <div className="flex items-center gap-2">
//                   <ShoppingBag className="w-5 h-5 text-[#10B981]" />
//                   <h3 className="text-lg font-black text-[#0B2545]">Your PËTIFY Cart</h3>
//                   <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
//                     {cart.reduce((a, b) => a + b.quantity, 0)} items
//                   </span>
//                 </div>
//                 <button
//                   onClick={() => setIsCartOpen(false)}
//                   className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
//                 >
//                   <X className="w-5 h-5" />
//                 </button>
//               </div>

//               {/* Cart Item List */}
//               <div className="p-6 overflow-y-auto flex-1 space-y-4">
//                 {cart.length === 0 ? (
//                   <div className="text-center py-12 space-y-3">
//                     <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
//                     <p className="text-sm font-bold text-slate-600">Your cart is empty</p>
//                     <p className="text-xs text-slate-400">Explore our bio-nutrition feeds and enclosures to add items.</p>
//                   </div>
//                 ) : (
//                   cart.map((item) => (
//                     <div key={item.id} className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
//                       <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover" />
//                       <div className="flex-1 min-w-0">
//                         <h4 className="text-xs font-extrabold text-[#0B2545] truncate">{item.name}</h4>
//                         <div className="text-xs text-[#10B981] font-bold mt-0.5">₹{item.price}</div>
                        
//                         <div className="flex items-center gap-3 mt-2">
//                           <button
//                             onClick={() => updateQuantity(item.id, -1)}
//                             className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
//                           >
//                             <Minus className="w-3 h-3" />
//                           </button>
//                           <span className="text-xs font-bold text-[#0B2545]">{item.quantity}</span>
//                           <button
//                             onClick={() => updateQuantity(item.id, 1)}
//                             className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
//                           >
//                             <Plus className="w-3 h-3" />
//                           </button>
//                         </div>
//                       </div>

//                       <div className="text-right font-black text-xs text-[#0B2545]">
//                         ₹{item.price * item.quantity}
//                       </div>
//                     </div>
//                   ))
//                 )}
//               </div>

//               {/* Cart Footer Checkout Action */}
//               {cart.length > 0 && (
//                 <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-4">
//                   <div className="flex justify-between items-center text-sm font-extrabold">
//                     <span className="text-slate-600">Total Amount:</span>
//                     <span className="text-xl text-[#0B2545]">₹{totalCartPrice}</span>
//                   </div>

//                   <a
//                     href={generateWhatsAppOrder()}
//                     target="_blank"
//                     rel="noopener noreferrer"
//                     className="w-full bg-[#10B981] hover:bg-[#0ea5e9] text-white font-extrabold text-xs py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
//                   >
//                     <MessageCircle className="w-5 h-5 fill-current" />
//                     <span>Checkout via WhatsApp (+91 97450 01101)</span>
//                   </a>
                  
//                   <p className="text-[10px] text-slate-400 text-center">
//                     Direct order placed with Kerala dispatch team. Fast shipping across India.
//                   </p>
//                 </div>
//               )}

//             </div>
//           </div>
//         </div>
//       )}

//     </div>
//   );
// }