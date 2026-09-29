const products=[
 {id:1,name:"Discord Server Boosts",category:"discord",price:2.99,description:"Digital server boosting service. Only use on servers you own or are authorized to manage."},
 {id:2,name:"Spotify Premium",category:"streaming",price:5.99,description:"Digital subscription product. Availability and eligibility may vary by region."},
 {id:3,name:"Netflix Premium",category:"streaming",price:7.99,description:"Digital subscription product. Availability and eligibility may vary by region."},
 {id:4,name:"TikTok Views",category:"social",price:1.99,description:"Social media service for eligible content. Use in accordance with platform rules."},
 {id:5,name:"Robux",category:"gaming",price:9.99,description:"Gaming currency/product. Delivery and availability depend on the selected option."},
 {id:6,name:"Discord Nitro",category:"discord",price:8.99,description:"Digital subscription product. Region and account eligibility may apply."},
 {id:7,name:"TikTok Likes",category:"social",price:2.49,description:"Social media service for eligible content. Use in accordance with platform rules."},
 {id:8,name:"Gaming Gift Card",category:"gaming",price:10.00,description:"Digital gift card. Region restrictions may apply."}
];
let cart=JSON.parse(localStorage.getItem("veloraCart")||"[]");
const $=s=>document.querySelector(s);
const productsEl=$("#products"),cartDrawer=$("#cartDrawer"),backdrop=$("#backdrop");
function money(n){return new Intl.NumberFormat("en-GB",{style:"currency",currency:"EUR"}).format(n)}
function renderProducts(filter="all"){
 const list=filter==="all"?products:products.filter(p=>p.category===filter);
 productsEl.innerHTML=list.map(p=>`<article class="product">
  <div class="product-visual ${p.category}"><div class="shape"></div><span class="product-badge">DIGITAL</span></div>
  <div class="product-info"><button class="add" onclick="addToCart(${p.id})">+</button><h3>${p.name}</h3><p>${p.description}</p><div class="price">${money(p.price)}</div></div>
 </article>`).join("");
}
function addToCart(id){cart.push(id);save();openCart();toast("Added to your bag")}
function removeFromCart(index){cart.splice(index,1);save();renderCart()}
function save(){localStorage.setItem("veloraCart",JSON.stringify(cart));renderCart()}
function renderCart(){
 $("#cartCount").textContent=cart.length;
 const items=cart.map(id=>products.find(p=>p.id===id)).filter(Boolean);
 if(!items.length){$("#cartItems").innerHTML='<p class="empty">Your bag is empty.</p>';$("#cartTotal").textContent=money(0);return}
 $("#cartItems").innerHTML=items.map((p,i)=>`<div class="cart-row"><div><strong>${p.name}</strong><br><small>${money(p.price)}</small></div><button class="remove" onclick="removeFromCart(${i})">Remove</button></div>`).join("");
 $("#cartTotal").textContent=money(items.reduce((a,p)=>a+p.price,0));
}
function openCart(){cartDrawer.classList.add("open");backdrop.classList.add("open")}
function closeCart(){cartDrawer.classList.remove("open");backdrop.classList.remove("open")}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderProducts(b.dataset.filter)}));
$("#cartBtn").onclick=openCart;$("#closeCart").onclick=closeCart;backdrop.onclick=closeCart;
$("#menuBtn").onclick=()=>$("#nav").classList.toggle("open");
$("#searchBtn").onclick=()=>{$("#searchOverlay").classList.add("open");$("#searchInput").focus()};
$("#closeSearch").onclick=()=>$("#searchOverlay").classList.remove("open");
$("#searchInput").addEventListener("input",e=>{const q=e.target.value.toLowerCase();const found=products.filter(p=>p.name.toLowerCase().includes(q)||p.category.includes(q));$("#searchResults").innerHTML=q?found.map(p=>`<div class="search-result"><strong>${p.name}</strong><span> — ${money(p.price)}</span></div>`).join("")||"<p class='search-result'>No products found.</p>":""});
$("#newsletterForm").addEventListener("submit",e=>{e.preventDefault();toast("You're on the Velora list.");e.target.reset()});
$("#supportForm").addEventListener("submit",e=>{e.preventDefault();toast("Message received — connect the API to store it.");e.target.reset()});
$("#checkoutBtn").onclick=()=>toast("Checkout API is ready to be connected.");
document.querySelectorAll(".nav a").forEach(a=>a.addEventListener("click",()=>$("#nav").classList.remove("open")));
renderProducts();renderCart();
