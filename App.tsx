import React, { useEffect, useMemo, useState } from "react";
import { Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

type Role = "admin" | "customer";
type OrderStatus = "Received" | "Washing" | "Drying" | "Ironing" | "Completed" | "Ready for Pickup" | "Picked Up" | "For Delivery" | "Delivered";
type PaymentStatus = "Unpaid" | "Partially Paid" | "Paid";
type Product = { id:string; name:string; price:number; stock:number; unit:string };
type Account = { id:string; username:string; password:string; name:string; role:Role };
type Order = { id:string; customerId:string; customerName:string; service:string; weight:number; amount:number; paid:number; payment:PaymentStatus; status:OrderStatus; fulfillment:"Pickup"|"Delivery"; createdAt:string; assignedStaffName?:string };
type Store = { accounts:Account[]; products:Product[]; orders:Order[]; duty:string[] };
const KEY = "laundriflow-complete-v3";

const C = {
  forest: "#0E3B2E",
  forest2: "#174C3B",
  mint: "#BDEBD8",
  mint2: "#EAF8F1",
  bg: "#F4F8F5",
  white: "#FFFFFF",
  ink: "#18352B",
  muted: "#789087",
  line: "#E0EBE5",
  green: "#26966C",
  red: "#D95B55",
  amber: "#C58A31"
};


const seed: Store = {
  accounts: [],

  products: [
    { id: "P-001", name: "Liquid Detergent", price: 120, stock: 18, unit: "liters" },
    { id: "P-002", name: "Fabric Conditioner", price: 95, stock: 12, unit: "liters" },
    { id: "P-003", name: "Plastic Laundry Bag", price: 5, stock: 100, unit: "pcs" },
    { id: "P-004", name: "Laundry Tag", price: 2, stock: 150, unit: "pcs" }
  ],

  orders: [],
  duty: ["Alex Worker", "Jamie Driver"]
};
const services=[{name:"Wash, Dry & Fold",rate:50},{name:"Wash & Dry",rate:40},{name:"Wash Only",rate:30},{name:"Dry Cleaning",rate:100}];
const laundryProcessStatuses:OrderStatus[]=["Received","Washing","Drying","Ironing","Completed"];
const fulfillmentStatuses=(method:"Pickup"|"Delivery"):OrderStatus[] =>
  method==="Pickup"
    ? ["Ready for Pickup","Picked Up"]
    : ["For Delivery","Delivered"];
const orderStatusesFor=(method:"Pickup"|"Delivery"):OrderStatus[] =>
  [...laundryProcessStatuses,...fulfillmentStatuses(method)];
const money=(n:number)=>"₱"+n.toFixed(2);
const id=()=>Math.random().toString(36).slice(2,7).toUpperCase();
function Btn({label,onPress,kind="primary"}:{label:string;onPress:()=>void;kind?:"primary"|"soft"|"danger"}){return <TouchableOpacity onPress={onPress} style={[s.btn,kind==="soft"&&s.btnSoft,kind==="danger"&&s.btnDanger]}><Text style={[s.btnText,kind==="soft"&&{color:C.forest}]}>{label}</Text></TouchableOpacity>}
function Input({value,onChangeText,placeholder,secure=false,keyboardType="default"}:any){return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#91A69C" secureTextEntry={secure} keyboardType={keyboardType} style={s.input}/>}
function Tag({text,color=C.green}:{text:string;color?:string}){return <View style={[s.tag,{backgroundColor:color+"18"}]}><Text style={{color,fontSize:11,fontWeight:"800"}}>{text}</Text></View>}
function Section({title,sub}:{title:string;sub?:string}){return <View style={{marginTop:18,marginBottom:10}}><Text style={s.sectionTitle}>{title}</Text>{!!sub&&<Text style={s.muted}>{sub}</Text>}</View>}
export default function App(){
 const [store,setStore]=useState<Store>(seed),[ready,setReady]=useState(false),[account,setAccount]=useState<Account|null>(null);
const [username, setUsername] = useState("");
const [password, setPassword] = useState("");

const [registerMode, setRegisterMode] = useState(false);
const [adminSetupMode, setAdminSetupMode] = useState(false);

const [regName, setRegName] = useState("");
const [regUser, setRegUser] = useState("");
const [regPass, setRegPass] = useState("");
 const [page,setPage]=useState("Dashboard");
 const [service,setService]=useState(services[0].name),[weight,setWeight]=useState("1"),[fulfillment,setFulfillment]=useState<"Pickup"|"Delivery">("Pickup");
 const [productName,setProductName]=useState(""),[productPrice,setProductPrice]=useState(""),[productStock,setProductStock]=useState(""),[productUnit,setProductUnit]=useState("pcs");
 const [staffName,setStaffName]=useState(""),[paymentInput,setPaymentInput]=useState<Record<string,string>>({});
  const [deliveryOrderId,setDeliveryOrderId]=useState<string|null>(null);
 useEffect(()=>{(async()=>{try{const raw=await AsyncStorage.getItem(KEY);if(raw)setStore(JSON.parse(raw));}catch(e){console.warn(e)}finally{setReady(true)}})()},[]);
 useEffect(()=>{if(ready)AsyncStorage.setItem(KEY,JSON.stringify(store)).catch(console.warn)},[store,ready]);
 const isAdmin=account?.role==="admin";
 const myOrders=useMemo(()=>store.orders.filter(o=>o.customerId===account?.id),[store.orders,account]);
 const totalRevenue=store.orders.reduce((a,o)=>a+o.paid,0);
 const login=()=>{const found=store.accounts.find(a=>a.username.toLowerCase()===username.trim().toLowerCase()&&a.password===password);if(!found){Alert.alert("Login failed","Please check your username and password.");return}setAccount(found);setPage("Dashboard");};
 const register = () => {
  if (!regName.trim() || !regUser.trim() || regPass.length < 6) {
    Alert.alert(
      "Check details",
      "Enter your name, username, and a password with at least 6 characters."
    );
    return;
  }

  if (
    store.accounts.some(
      a => a.username.toLowerCase() === regUser.trim().toLowerCase()
    )
  ) {
    Alert.alert("Username unavailable", "Choose another username.");
    return;
  }

  const newCustomer: Account = {
    id: "C-" + id(),
    username: regUser.trim(),
    password: regPass,
    name: regName.trim(),
    role: "customer"
  };

  setStore(v => ({
    ...v,
    accounts: [...v.accounts, newCustomer]
  }));

  setAccount(newCustomer);
  setRegisterMode(false);
  setRegName("");
  setRegUser("");
  setRegPass("");
  setPage("Dashboard");
};

const setupAdmin = () => {
  if (store.accounts.some(a => a.role === "admin")) {
    Alert.alert(
      "Admin account already exists",
      "For security, only the first Admin account can be created from this screen. Ask the existing Admin to manage access."
    );
    setAdminSetupMode(false);
    return;
  }
  if (!regName.trim() || !regUser.trim() || regPass.length < 8) {
    Alert.alert(
      "Check details",
      "Enter admin name, username, and a password with at least 8 characters."
    );
    return;
  }

  if (store.accounts.some(
    a => a.username.toLowerCase() === regUser.trim().toLowerCase()
  )) {
    Alert.alert("Username unavailable", "Choose another username.");
    return;
  }

  const newAdmin: Account = {
    id: "A-" + id(),
    username: regUser.trim(),
    password: regPass,
    name: regName.trim(),
    role: "admin"
  };

  setStore(v => ({
    ...v,
    accounts: [...v.accounts, newAdmin]
  }));

  setAccount(newAdmin);
  setAdminSetupMode(false);
  setRegName("");
  setRegUser("");
  setRegPass("");
  setPage("Dashboard");
};
 const logout = () => {
   setAccount(null);
   setUsername("");
   setPassword("");
   setRegisterMode(false);
   setAdminSetupMode(false);
   setPage("Dashboard");
 };
 const createOrder=()=>{const kg=Number(weight);if(!Number.isFinite(kg)||kg<=0){Alert.alert("Invalid weight","Enter a valid laundry weight.");return}const rate=services.find(x=>x.name===service)?.rate||50;const o:Order={id:"LF-"+Date.now().toString().slice(-6),customerId:account!.id,customerName:account!.name,service,weight:kg,amount:rate*kg,paid:0,payment:"Unpaid",status:"Received",fulfillment,createdAt:new Date().toLocaleDateString()};setStore(v=>({...v,orders:[o,...v.orders]}));setWeight("1");Alert.alert("Order submitted",`Your order ${o.id} has been created. Total: ${money(o.amount)}`);setPage("My Laundry");};
 const updateOrder=(orderId:string,patch:Partial<Order>)=>setStore(v=>({...v,orders:v.orders.map(o=>{
   if(o.id!==orderId)return o;
   const isAlreadyFullyPaid=o.amount>0&&o.paid>=o.amount;
   if(isAlreadyFullyPaid&&("paid" in patch||"payment" in patch))return o;
   const terminalStatuses:OrderStatus[]=["Picked Up","Delivered"];
   if(terminalStatuses.includes(o.status))return o;
   if(patch.status&&!orderStatusesFor(o.fulfillment).includes(patch.status))return o;
   // A delivery can only be completed when assigned staff exists and the order is fully paid.
   if(patch.status==="Delivered" && (o.fulfillment!=="Delivery" || !o.assignedStaffName || !(o.amount>0 && o.paid>=o.amount)))return o;
   if(patch.assignedStaffName && o.fulfillment!=="Delivery")return o;
   return {...o,...patch};
 })}));
 const recordPayment=(orderId:string,amountText:string)=>{
   const order=store.orders.find(o=>o.id===orderId);
   if(!order)return;
   const currentPaid=Math.max(0,Math.min(order.amount,order.paid));
   const balance=Math.max(0,order.amount-currentPaid);
   if(balance<=0){
     Alert.alert("Fully Paid","This customer is totally paid. The payment record is locked and can no longer be changed.");
     return;
   }
   const received=Number(amountText);
   if(!Number.isFinite(received)||received<=0){
     Alert.alert("Invalid payment","Enter an amount greater than ₱0.00.");
     return;
   }
   if(received>balance){
     Alert.alert("Amount exceeds balance",`The remaining balance is ${money(balance)}. Enter an amount up to ${money(balance)}.`);
     return;
   }
   const newPaid=currentPaid+received;
   const fullyPaid=newPaid>=order.amount;
   updateOrder(orderId,{
     paid:newPaid,
     payment:fullyPaid?"Paid":newPaid>0?"Partially Paid":"Unpaid"
   });
   setPaymentInput(prev=>({...prev,[orderId]:""}));
   if(fullyPaid){
     Alert.alert("Payment completed","This customer is totally paid. The payment record is now locked.");
   }else{
     Alert.alert("Payment saved",`${money(received)} received. Remaining balance: ${money(order.amount-newPaid)}.`);
   }
 };
 const addProduct=()=>{const price=Number(productPrice),stock=Number(productStock);if(!productName.trim()||price<=0||stock<0){Alert.alert("Invalid product","Enter a product name, valid price, and stock quantity.");return}setStore(v=>({...v,products:[...v.products,{id:"P-"+id(),name:productName.trim(),price,stock,unit:productUnit}]}));setProductName("");setProductPrice("");setProductStock("");};
 const addStaff=()=>{if(!staffName.trim())return;if(store.duty.some(n=>n.toLowerCase()===staffName.trim().toLowerCase())){Alert.alert("Staff already exists","This staff member is already on the duty list.");return;}setStore(v=>({...v,duty:[...v.duty,staffName.trim()]}));setStaffName("");};
 const activeDeliveryFor=(name:string,excludeOrderId?:string)=>store.orders.some(o=>o.id!==excludeOrderId&&o.fulfillment==="Delivery"&&o.status==="For Delivery"&&o.assignedStaffName===name);
 const assignDeliveryStaff=(orderId:string,name:string)=>{
   const order=store.orders.find(o=>o.id===orderId);
   if(!order||order.fulfillment!=="Delivery"||order.status==="Delivered"){setDeliveryOrderId(null);return;}
   if(activeDeliveryFor(name,orderId)){Alert.alert("Staff unavailable","This staff member is already assigned to another active delivery.");return;}
   updateOrder(orderId,{status:"For Delivery",assignedStaffName:name});
   setDeliveryOrderId(null);
   Alert.alert("Delivery assigned",`${name} has been assigned to order ${orderId}.`);
 };
 if(!ready)return <SafeAreaView style={s.center}><Text style={s.muted}>Loading LaundriFlow…</Text></SafeAreaView>;
 if (!account) return (
   <SafeAreaView style={s.login}>
     <StatusBar barStyle="light-content" backgroundColor={C.forest} />
     <ScrollView
       style={{ flex: 1, width: "100%" }}
       contentContainerStyle={s.loginScroll}
       keyboardShouldPersistTaps="handled"
       showsVerticalScrollIndicator={false}
     >

     <View style={s.loginHero}>
       <View style={s.logo}>
         <Ionicons name="water" size={30} color={C.forest} />
       </View>

       <Text style={s.brand}>
         Laundri<Text style={{ color: C.mint }}>Flow</Text>
       </Text>

       <Text style={s.brandSub}>LOG IN • LAUNDRY MANAGEMENT</Text>
       <Text style={s.heroTitle}>
         A cleaner way to manage every load.
       </Text>
     </View>

     <View style={s.loginCard}>
       <Text style={s.sectionTitle}>
         {adminSetupMode
           ? "Set Up Admin Account"
           : registerMode
           ? "Create Customer Account"
           : "LOG IN"}
       </Text>

       <Text style={s.muted}>
         {adminSetupMode
           ? "Create the first administrator account."
           : registerMode
           ? "Create your own private customer account."
           : "Sign in to your own workspace."}
       </Text>

       {(registerMode || adminSetupMode) ? (
         <>
           <Input
             value={regName}
             onChangeText={setRegName}
             placeholder="Full name"
           />

           <Input
             value={regUser}
             onChangeText={setRegUser}
             placeholder="Create username"
           />

           <Input
             value={regPass}
             onChangeText={setRegPass}
             placeholder={
               adminSetupMode
                 ? "Password (minimum 8 characters)"
                 : "Password (minimum 6 characters)"
             }
             secure
           />
         </>
       ) : (
         <>
           <Input
             value={username}
             onChangeText={setUsername}
             placeholder="Username"
           />

           <Input
             value={password}
             onChangeText={setPassword}
             placeholder="Password"
             secure
           />
         </>
       )}

       <View style={{ width: "100%", gap: 2 }}>
       <Btn
         label={
           adminSetupMode
             ? "CREATE ADMIN ACCOUNT"
             : registerMode
             ? "CREATE CUSTOMER ACCOUNT"
             : "LOG IN"
         }
         onPress={
           adminSetupMode
             ? setupAdmin
             : registerMode
             ? register
             : login
         }
       />

       {!registerMode && !adminSetupMode && (
         <>
           <Btn
             label="CREATE CUSTOMER ACCOUNT"
             kind="soft"
             onPress={() => {
               setRegisterMode(true);
               setRegName("");
               setRegUser("");
               setRegPass("");
             }}
           />

           <Btn
             label="CREATE ADMIN ACCOUNT"
             kind="soft"
             onPress={() => {
               if (store.accounts.some(a => a.role === "admin")) {
                 Alert.alert(
                   "Admin account already exists",
                   "The first Admin account has already been created. For security, additional Admin accounts must be managed by the existing Admin."
                 );
                 return;
               }
               setAdminSetupMode(true);
               setRegName("");
               setRegUser("");
               setRegPass("");
             }}
           />
         </>
       )}

       {(registerMode || adminSetupMode) && (
         <Btn
           label="BACK TO LOG IN"
           kind="soft"
           onPress={() => {
             setRegisterMode(false);
             setAdminSetupMode(false);
             setRegName("");
             setRegUser("");
             setRegPass("");
           }}
         />
       )}
       </View>
     </View>

     <Text style={s.footer}>
       LAUNDRIFLOW • DEEP FOREST EDITION
     </Text>
     </ScrollView>
   </SafeAreaView>
 );

 const adminPages=["Dashboard","Orders","Products & Prices","Inventory","Staff Duty","Customers"];
 const customerPages=["Dashboard","Place Order","My Laundry","My Profile"];
 const pages=isAdmin?adminPages:customerPages;
 const nav=(p:string)=><TouchableOpacity key={p} onPress={()=>setPage(p)} style={[s.navItem,page===p&&s.navActive]}><Text style={[s.navText,page===p&&s.navTextActive]}>{p}</Text></TouchableOpacity>;
 return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.forest}/><View style={s.top}><View><Text style={s.brandSmall}>Laundri<Text style={{color:C.mint}}>Flow</Text></Text><Text style={s.brandSub}>{isAdmin?"ADMIN MANAGEMENT":"CUSTOMER PORTAL"}</Text></View><TouchableOpacity onPress={logout} style={s.logout}><Ionicons name="log-out-outline" color="#F5C6BD" size={17}/><Text style={{color:"#F5C6BD",fontWeight:"700"}}> Logout</Text></TouchableOpacity></View>
 <View style={s.nav}>{pages.map(nav)}</View>
 <ScrollView contentContainerStyle={s.content}>
 {page==="Dashboard"&&isAdmin&&<><View style={s.banner}><Text style={s.bannerKicker}>ADMIN WORKSPACE</Text><Text style={s.bannerTitle}>Good day, Administrator</Text><Text style={s.bannerSub}>Manage laundry operations from one place.</Text></View><View style={s.stats}><Stat label="Total orders" value={String(store.orders.length)}/><Stat label="In process" value={String(store.orders.filter(o=>!["Completed","Ready for Pickup","Picked Up","Delivered"].includes(o.status)).length)}/><Stat label="Revenue collected" value={money(totalRevenue)}/><Stat label="Customers" value={String(store.accounts.filter(a=>a.role==="customer").length)}/></View></>}
 {page==="Dashboard"&&!isAdmin&&<><View style={s.banner}><Text style={s.bannerKicker}>CUSTOMER PORTAL</Text><Text style={s.bannerTitle}>Hello, {account.name}</Text><Text style={s.bannerSub}>Track your laundry, payments, and pickup or delivery.</Text></View><View style={s.stats}><Stat label="My orders" value={String(myOrders.length)}/><Stat label="In process" value={String(myOrders.filter(o=>!["Completed","Picked Up","Delivered"].includes(o.status)).length)}/><Stat label="Outstanding" value={money(myOrders.reduce((a,o)=>a+(o.amount-o.paid),0))}/></View><Section title="My latest laundry"/>{myOrders.slice(0,4).map(o=><OrderCard key={o.id} o={o}/>) }{myOrders.length===0&&<Empty text="You have no laundry orders yet. Place your first order to get started."/>}</>}
 {page==="Orders"&&isAdmin&&<><Section title="All laundry orders" sub="Update laundry progress, payment, pickup, and delivery status."/>{store.orders.map(o=><OrderCard key={o.id} o={o} admin onStatus={v=>updateOrder(o.id,{status:v})} onRequestDelivery={()=>setDeliveryOrderId(o.id)} onPaid={v=>recordPayment(o.id,v)} paymentValue={paymentInput[o.id]??""} setPaymentValue={v=>setPaymentInput(p=>({...p,[o.id]:v}))}/>)}</>}
 {page==="Place Order"&&!isAdmin&&<><Section title="Place a laundry order" sub="Choose a service and submit your laundry details."/><View style={s.card}><Text style={s.label}>LAUNDRY SERVICE</Text>{services.map(x=><TouchableOpacity key={x.name} onPress={()=>setService(x.name)} style={[s.choice,service===x.name&&s.choiceOn]}><Text style={s.body}>{x.name}</Text><Text style={s.price}>{money(x.rate)} / kg {service===x.name?"✓":""}</Text></TouchableOpacity>)}<Text style={s.label}>WEIGHT (KG)</Text><Input value={weight} onChangeText={setWeight} placeholder="Enter weight" keyboardType="decimal-pad"/><Text style={s.label}>FULFILLMENT METHOD</Text><View style={s.row}><Btn label="Pickup" kind={fulfillment==="Pickup"?"primary":"soft"} onPress={()=>setFulfillment("Pickup")}/><Btn label="Delivery" kind={fulfillment==="Delivery"?"primary":"soft"} onPress={()=>setFulfillment("Delivery")}/></View><View style={s.total}><Text style={s.muted}>Estimated total</Text><Text style={s.totalAmount}>{money((services.find(x=>x.name===service)?.rate||50)*(Number(weight)||0))}</Text></View><Btn label="Submit laundry order" onPress={createOrder}/></View></>}
 {page==="My Laundry"&&!isAdmin&&<><Section title="My laundry tracking" sub="Only your own laundry orders are displayed."/>{myOrders.map(o=><OrderCard key={o.id} o={o}/>) }{myOrders.length===0&&<Empty text="No orders found. Use Place Order to create one."/>}</>}
 {page==="My Profile"&&!isAdmin&&<><Section title="My account"/><View style={s.card}><Info label="Customer name" value={account.name}/><Info label="Username" value={account.username}/><Info label="Customer ID" value={account.id}/><Tag text="CUSTOMER ACCOUNT"/></View></>}
 {page==="Products & Prices"&&isAdmin&&<><Section title="Manage products and service rates"/><View style={s.card}><Text style={s.label}>ADD INVENTORY PRODUCT</Text><Input value={productName} onChangeText={setProductName} placeholder="Product name"/><Input value={productPrice} onChangeText={setProductPrice} placeholder="Unit cost / price" keyboardType="decimal-pad"/><Input value={productStock} onChangeText={setProductStock} placeholder="Initial stock quantity" keyboardType="decimal-pad"/><Input value={productUnit} onChangeText={setProductUnit} placeholder="Unit (pcs, liters, kg)"/><Btn label="Add product" onPress={addProduct}/></View><Section title="Laundry service prices"/>{services.map(x=><View key={x.name} style={s.listRow}><View style={{flex:1}}><Text style={s.itemTitle}>{x.name}</Text><Text style={s.muted}>Per kilogram</Text></View><Text style={s.price}>{money(x.rate)}/kg</Text></View>)}</>}
 {page==="Inventory"&&isAdmin&&<><Section title="Inventory overview" sub="Admin-only stock visibility."/><View style={s.stats}><Stat label="Products" value={String(store.products.length)}/><Stat label="Total units" value={String(store.products.reduce((a,p)=>a+p.stock,0))}/></View>{store.products.map(p=><View key={p.id} style={s.listRow}><View style={{flex:1}}><Text style={s.itemTitle}>{p.name}</Text><Text style={s.muted}>{money(p.price)} per {p.unit}</Text></View><Tag text={`${p.stock} ${p.unit}`} color={p.stock<10?C.red:C.green}/><Btn label="+1" kind="soft" onPress={()=>setStore(v=>({...v,products:v.products.map(x=>x.id===p.id?{...x,stock:x.stock+1}:x)}))}/><Btn label="-1" kind="soft" onPress={()=>setStore(v=>({...v,products:v.products.map(x=>x.id===p.id?{...x,stock:Math.max(0,x.stock-1)}:x)}))}/></View>)}</>}
 {page==="Staff Duty"&&isAdmin&&<><Section title="Staff on duty today" sub={new Date().toLocaleDateString()}/><View style={s.card}><Input value={staffName} onChangeText={setStaffName} placeholder="Staff full name"/><Btn label="Add staff on duty" onPress={addStaff}/></View>{store.duty.map((name,i)=>{const busy=activeDeliveryFor(name);return <View key={i} style={s.listRow}><View style={{flex:1}}><Text style={s.itemTitle}>{name}</Text><Text style={s.muted}>Assigned for today's duty</Text></View><Tag text={busy?"ON DELIVERY":"AVAILABLE"} color={busy?C.amber:C.green}/><TouchableOpacity disabled={busy} style={[s.btn,s.btnDanger,busy&&{opacity:0.35}]} onPress={()=>setStore(v=>({...v,duty:v.duty.filter((_,j)=>j!==i)}))}><Text style={s.btnText}>{busy?"Assigned":"Remove"}</Text></TouchableOpacity></View>})}</>}
 {page==="Customers"&&isAdmin&&<><Section title="Registered customers" sub="Customer account directory. Passwords are never displayed."/>{store.accounts.filter(a=>a.role==="customer").map(a=><View key={a.id} style={s.listRow}><View style={{flex:1}}><Text style={s.itemTitle}>{a.name}</Text><Text style={s.muted}>{a.username} · {a.id}</Text></View><Tag text="CUSTOMER"/></View>)}</>}
 </ScrollView>
 {deliveryOrderId!==null&&<View style={s.modalBackdrop}>
   <View style={s.deliveryModal}>
     <View style={s.rowBetween}>
       <Text style={s.sectionTitle}>Select delivery staff</Text>
       <TouchableOpacity onPress={()=>setDeliveryOrderId(null)}><Ionicons name="close" size={24} color={C.ink}/></TouchableOpacity>
     </View>
     <Text style={s.muted}>Choose one available staff member to deliver this order.</Text>
     {store.duty.map((name,i)=>{
       const busy=activeDeliveryFor(name,deliveryOrderId);
       return <TouchableOpacity key={`${name}-${i}`} disabled={busy} onPress={()=>assignDeliveryStaff(deliveryOrderId,name)} style={[s.staffOption,busy&&{opacity:0.4}]}>
         <View style={{flex:1}}>
           <Text style={s.itemTitle}>{name}</Text>
           <Text style={s.muted}>{busy?"Currently assigned to another delivery":"Available for delivery"}</Text>
         </View>
         <Tag text={busy?"BUSY":"AVAILABLE"} color={busy?C.red:C.green}/>
       </TouchableOpacity>;
     })}
     {store.duty.length===0&&<Empty text="No staff members are listed. Add staff in Staff Duty first."/>}
     <Btn label="CANCEL" kind="soft" onPress={()=>setDeliveryOrderId(null)}/>
   </View>
 </View>}
 </SafeAreaView>;
}
function Stat({label,value}:{label:string;value:string}){return <View style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>}
function Info({label,value}:{label:string;value:string}){return <View style={s.info}><Text style={s.muted}>{label}</Text><Text style={s.itemTitle}>{value}</Text></View>}
function Empty({text}:{text:string}){return <View style={s.card}><Text style={s.muted}>{text}</Text></View>}
function OrderCard({o,admin=false,onStatus,onRequestDelivery,onPaid,paymentValue,setPaymentValue}:{o:Order;admin?:boolean;onStatus?:(v:OrderStatus)=>void;onRequestDelivery?:()=>void;onPaid?:(v:string)=>void;paymentValue?:string;setPaymentValue?:(v:string)=>void}){
 const paid=Math.max(0,Math.min(o.amount,o.paid));
 const balance=Math.max(0,o.amount-paid);
 const fullyPaid=balance<=0;
 const paymentState:PaymentStatus=fullyPaid?"Paid":paid>0?"Partially Paid":"Unpaid";
 return <View style={s.card}>
   <View style={s.rowBetween}>
     <View><Text style={s.orderId}>{o.id}</Text><Text style={s.itemTitle}>{o.customerName}</Text></View>
     <Tag text={paymentState} color={fullyPaid?C.green:paid>0?C.amber:C.red}/>
   </View>
   <Text style={s.body}>{o.service} · {o.weight} kg · {o.fulfillment}</Text>
   <View style={s.paymentBreakdown}>
     <View style={s.paymentLine}><Text style={s.muted}>Total laundry price</Text><Text style={s.price}>{money(o.amount)}</Text></View>
     <View style={s.paymentLine}><Text style={s.muted}>Total amount paid</Text><Text style={s.paymentPaid}>{money(paid)}</Text></View>
     <View style={s.paymentLine}><Text style={s.muted}>Remaining balance</Text><Text style={[s.paymentBalance,{color:balance>0?C.red:C.green}]}>{money(balance)}</Text></View>
   </View>
   <View style={s.rowBetween}><Tag text={o.status} color={o.status==="Delivered"||o.status==="Picked Up"?C.green:C.amber}/><Text style={s.muted}>{o.fulfillment==="Pickup"?(o.status==="Picked Up"?"Picked up":o.status==="Ready for Pickup"?"Ready for pickup":"Pickup"):o.status==="Delivered"?"Delivered":o.status==="For Delivery"?"Out for delivery":"Delivery"} · {o.createdAt}</Text></View>
   {admin&&<>
     <Text style={s.label}>UPDATE LAUNDRY / PICKUP / DELIVERY STATUS</Text>
     <View style={s.statusWrap}>{orderStatusesFor(o.fulfillment).map(v=>{
       const terminal=["Picked Up","Delivered"].includes(o.status);
       const selected=o.status===v;
       const requiresFullPayment=v==="Delivered" && !fullyPaid;
       const disabled=terminal||selected||requiresFullPayment;
       const handlePress=()=>{if(v==="For Delivery"){onRequestDelivery?.();return;}onStatus?.(v);};
       return <TouchableOpacity key={v} disabled={disabled} onPress={handlePress} style={[s.statusBtn,selected&&s.statusSelected,disabled&&{opacity:0.4}]}><Text style={[s.statusText,selected&&{color:C.white}]}>{v}</Text></TouchableOpacity>;
     })}</View>
     {o.fulfillment==="Delivery"&&<View style={s.deliveryAssignmentInfo}>
       <Ionicons name="bicycle-outline" size={14} color={o.assignedStaffName?C.green:C.amber}/>
       <Text style={{fontSize:10,fontWeight:"800",color:o.assignedStaffName?C.green:C.amber}}>
         {o.assignedStaffName?`Delivery staff: ${o.assignedStaffName}`:"No delivery staff assigned. Select For Delivery to assign staff."}
       </Text>
     </View>}
     {o.fulfillment==="Delivery" && !fullyPaid && o.status!=="Delivered" && <View style={s.lockedPayment}><Ionicons name="lock-closed" size={13} color={C.amber}/><Text style={{color:C.amber,fontSize:10,fontWeight:"800"}}>Delivery is locked until fully paid. Balance: {money(balance)}</Text></View>}
     {["Picked Up","Delivered"].includes(o.status)&&<View style={s.paymentLocked}><Ionicons name="lock-closed" size={13} color={C.green}/><Text style={{color:C.green,fontSize:10,fontWeight:"800"}}>{o.status==="Picked Up"?"Laundry picked up — status locked.":"Laundry delivered — status locked."}</Text></View>}
     <Text style={s.label}>PAYMENT STATUS</Text>
     <View style={s.paymentStatusRow}>
       <Tag text={paymentState} color={fullyPaid?C.green:paid>0?C.amber:C.red}/>
       {fullyPaid&&<Text style={s.fullyPaidNote}>This customer is totally paid.</Text>}
     </View>
     {fullyPaid?
       <View style={s.lockedPayment}><Ionicons name="lock-closed" size={15} color={C.green}/><Text style={s.lockedPaymentText}>Payment completed · Editing disabled</Text></View>
       :
       <>
         <Text style={s.label}>AMOUNT RECEIVED NOW</Text>
         <View style={s.row}>
           <View style={{flex:1}}>
             <TextInput value={paymentValue??""} onChangeText={setPaymentValue} keyboardType="decimal-pad" style={s.input} placeholder={`Enter amount (balance ${money(balance)})`}/>
           </View>
           <TouchableOpacity style={s.savePaymentButton} onPress={()=>onPaid?.(paymentValue||"")}><Text style={s.savePaymentText}>Save Payment</Text></TouchableOpacity>
         </View>
         <Text style={s.paymentHint}>Partial payments are accepted. The balance updates automatically. Maximum payment: {money(balance)}.</Text>
       </>
     }
   </>}
 </View>
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:C.bg},center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:C.bg},login:{flex:1,backgroundColor:C.forest,paddingHorizontal:16,paddingTop:8,paddingBottom:8},
loginScroll:{flexGrow:1,justifyContent:"center",alignItems:"center",paddingVertical:12},textLink:{alignItems:"center",paddingTop:12,paddingBottom:2},textLinkText:{fontSize:10,color:C.muted,textAlign:"center"},loginHero:{alignItems:"center",marginBottom:12},logo:{width:62,height:62,borderRadius:20,backgroundColor:C.mint,alignItems:"center",justifyContent:"center",marginBottom:12},brand:{fontSize:32,fontWeight:"900",color:C.white,letterSpacing:-1},brandSmall:{fontSize:23,fontWeight:"900",color:C.white},brandSub:{fontSize:9,letterSpacing:2,color:C.mint,marginTop:3},heroTitle:{fontSize:21,fontWeight:"800",color:C.white,textAlign:"center",marginTop:10,maxWidth:300},loginCard:{backgroundColor:C.white,borderRadius:18,padding:16,width:"100%",alignSelf:"center"},footer:{color:"#BDEBD8",fontSize:9,textAlign:"center",letterSpacing:2,marginTop:12},sectionTitle:{fontSize:18,fontWeight:"900",color:C.ink},muted:{fontSize:12,color:C.muted,marginTop:4},input:{borderWidth:1,borderColor:C.line,backgroundColor:"#FBFDFC",borderRadius:11,paddingHorizontal:13,paddingVertical:12,fontSize:14,color:C.ink,marginTop:10,marginBottom:3},btn:{backgroundColor:C.forest,borderRadius:10,paddingHorizontal:13,paddingVertical:12,alignItems:"center",justifyContent:"center",marginTop:9,flex:1},btnSoft:{backgroundColor:C.mint2,borderWidth:1,borderColor:C.mint},btnDanger:{backgroundColor:C.red},btnText:{color:C.white,fontSize:12,fontWeight:"800"},top:{backgroundColor:C.forest,paddingHorizontal:18,paddingVertical:14,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},logout:{flexDirection:"row",alignItems:"center",padding:8},nav:{flexDirection:"row",flexWrap:"wrap",backgroundColor:C.forest2,paddingHorizontal:8,paddingVertical:7},navItem:{paddingHorizontal:11,paddingVertical:9,borderRadius:9,margin:2},navActive:{backgroundColor:C.mint},navText:{color:"#C8DED3",fontSize:11,fontWeight:"700"},navTextActive:{color:C.forest},content:{padding:16,paddingBottom:40},banner:{backgroundColor:C.forest,borderRadius:18,padding:20},bannerKicker:{color:C.mint,fontSize:9,letterSpacing:2,fontWeight:"800"},bannerTitle:{color:C.white,fontSize:22,fontWeight:"900",marginTop:9},bannerSub:{color:"#D5E8DF",fontSize:12,marginTop:5},stats:{flexDirection:"row",flexWrap:"wrap",gap:9,marginTop:12},stat:{backgroundColor:C.white,borderRadius:13,padding:13,flexGrow:1,minWidth:"28%",borderWidth:1,borderColor:C.line},statValue:{fontSize:17,fontWeight:"900",color:C.forest},statLabel:{fontSize:10,color:C.muted,marginTop:4},card:{backgroundColor:C.white,borderRadius:15,borderWidth:1,borderColor:C.line,padding:15,marginBottom:11},row:{flexDirection:"row",gap:8,alignItems:"center"},rowBetween:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},label:{fontSize:9,fontWeight:"900",letterSpacing:1,color:C.muted,marginTop:14,marginBottom:2},body:{fontSize:12,color:C.ink,marginTop:8},price:{fontSize:13,fontWeight:"900",color:C.forest},total:{backgroundColor:C.mint2,padding:14,borderRadius:12,marginTop:15,marginBottom:5},totalAmount:{fontSize:23,fontWeight:"900",color:C.forest,marginTop:3},choice:{borderWidth:1,borderColor:C.line,borderRadius:10,padding:12,marginTop:7,flexDirection:"row",justifyContent:"space-between"},choiceOn:{borderColor:C.green,backgroundColor:C.mint2},listRow:{backgroundColor:C.white,borderRadius:12,padding:12,marginBottom:8,flexDirection:"row",alignItems:"center",gap:8,borderWidth:1,borderColor:C.line},itemTitle:{fontSize:13,fontWeight:"800",color:C.ink,marginTop:3},tag:{paddingHorizontal:9,paddingVertical:5,borderRadius:20},orderId:{fontSize:10,color:C.green,fontWeight:"900",letterSpacing:1},info:{paddingVertical:10,borderBottomWidth:1,borderBottomColor:C.line},statusWrap:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:7},statusBtn:{borderWidth:1,borderColor:C.line,borderRadius:20,paddingHorizontal:9,paddingVertical:7},statusSelected:{backgroundColor:C.forest,borderColor:C.forest},statusText:{fontSize:10,color:C.ink,fontWeight:"700"},
 paymentBreakdown:{backgroundColor:C.bg,borderRadius:10,padding:11,marginTop:10,marginBottom:10},
 paymentLine:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:3},
 paymentPaid:{fontSize:12,fontWeight:"800",color:C.green},
 paymentBalance:{fontSize:13,fontWeight:"900"},
 paymentStatusRow:{flexDirection:"row",alignItems:"center",gap:9,marginTop:6},
 fullyPaidNote:{fontSize:11,fontWeight:"800",color:C.green},
 lockedPayment:{flexDirection:"row",alignItems:"center",gap:7,backgroundColor:C.mint2,borderRadius:10,padding:12,marginTop:10},
 lockedPaymentText:{fontSize:11,fontWeight:"800",color:C.green},
 savePaymentButton:{backgroundColor:C.forest,borderRadius:10,paddingHorizontal:16,justifyContent:"center",alignItems:"center",marginTop:9},
 savePaymentText:{color:C.white,fontSize:12,fontWeight:"900"},
 paymentHint:{fontSize:10,color:C.muted,marginTop:6,lineHeight:15},
 deliveryAssignmentInfo:{flexDirection:"row",alignItems:"center",gap:7,backgroundColor:C.mint2,borderRadius:9,padding:10,marginTop:9},
 modalBackdrop:{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(0,0,0,0.48)",justifyContent:"center",padding:20,zIndex:20},
 deliveryModal:{backgroundColor:C.white,borderRadius:18,padding:17,maxHeight:"80%"},
 staffOption:{flexDirection:"row",alignItems:"center",gap:10,borderWidth:1,borderColor:C.line,borderRadius:12,padding:12,marginTop:9}
});
//final