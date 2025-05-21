// Firebase configuration - Replace with your actual config

  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

;

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Vue application
const { createApp, ref, onMounted, computed, watch } = Vue;

createApp({
  setup() {
    // Authentication state
    const isAuthenticated = ref(false);
    const userEmail = ref('');
    const loginEmail = ref('');
    const loginPassword = ref('');
    const registerEmail = ref('');
    const registerPassword = ref('');
    const registerConfirm = ref('');
    const showRegister = ref(false);

    // Current view
    const currentView = ref('dashboard');

    // Data collections
    const products = ref([]);
    const purchases = ref([]);
    const sales = ref([]);
    const customers = ref([]);
    
    // Form data
    const productForm = ref({
      id: '',
      name: '',
      category: '',
      purchasePrice: 0,
      sellingPrice: 0,
      stock: 0
    });
    
    const purchaseForm = ref({
      date: new Date().toISOString().split('T')[0],
      supplier: '',
      productId: '',
      quantity: 1,
      unitPrice: 0
    });
    
    const saleForm = ref({
      date: new Date().toISOString().split('T')[0],
      customerId: '',
      items: [{ productId: '', quantity: 1, unitPrice: 0 }],
      totalAmount: 0
    });
    
    const customerForm = ref({
      id: '',
      name: '',
      email: '',
      phone: ''
    });
    
    // UI states
    const showAddProductModal = ref(false);
    const showAddPurchaseModal = ref(false);
    const showAddSaleModal = ref(false);
    const showAddCustomerModal = ref(false);
    const editingProduct = ref(false);
    const editingCustomer = ref(false);
    const confirmMessage = ref('');
    const confirmAction = ref(() => {});
    
    // Reports filters
    const reportMonth = ref('');
    const reportYear = ref('');
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Charts
    let salesChart = null;
    let productsChart = null;
    
    // Computed properties
    const totalProducts = computed(() => products.value.length);
    const totalStockValue = computed(() => {
      return products.value.reduce((sum, product) => sum + (product.stock * product.purchasePrice), 0);
    });
    
    const monthlySales = computed(() => {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      return sales.value
        .filter(sale => {
          const saleDate = new Date(sale.date);
          return saleDate.getMonth() + 1 === currentMonth && saleDate.getFullYear() === currentYear;
        })
        .reduce((sum, sale) => sum + sale.totalAmount, 0);
    });
    
    const monthlyProfit = computed(() => {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      return sales.value
        .filter(sale => {
          const saleDate = new Date(sale.date);
          return saleDate.getMonth() + 1 === currentMonth && saleDate.getFullYear() === currentYear;
        })
        .reduce((sum, sale) => sum + calculateSaleProfit(sale), 0);
    });
    
    const lowStockProducts = computed(() => {
      return products.value.filter(product => product.stock < 10).sort((a, b) => a.stock - b.stock);
    });
    
    const recentSales = computed(() => {
      return [...sales.value]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
    });
    
    const availableYears = computed(() => {
      const years = new Set();
      sales.value.forEach(sale => {
        years.add(new Date(sale.date).getFullYear());
      });
      purchases.value.forEach(purchase => {
        years.add(new Date(purchase.date).getFullYear());
      });
      return Array.from(years).sort((a, b) => b - a);
    });
    
    const filteredTransactions = computed(() => {
      let transactions = [];
      
      // Add sales
      sales.value.forEach(sale => {
        transactions.push({
          id: sale.id,
          date: sale.date,
          type: 'Sale',
          customerName: sale.customerName,
          totalAmount: sale.totalAmount,
          ...sale
        });
      });
      
      // Add purchases
      purchases.value.forEach(purchase => {
        transactions.push({
          id: purchase.id,
          date: purchase.date,
          type: 'Purchase',
          supplier: purchase.supplier,
          quantity: purchase.quantity,
          unitPrice: purchase.unitPrice,
          ...purchase
        });
      });
      
      // Sort by date
      transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Apply filters
      if (reportMonth.value || reportYear.value) {
        transactions = transactions.filter(trans => {
          const date = new Date(trans.date);
          const monthMatch = !reportMonth.value || (date.getMonth() + 1 === parseInt(reportMonth.value));
          const yearMatch = !reportYear.value || (date.getFullYear() === parseInt(reportYear.value));
          return monthMatch && yearMatch;
        });
      }
      
      return transactions;
    });
    
    const filteredSalesTotal = computed(() => {
      return filteredTransactions.value
        .filter(trans => trans.type === 'Sale')
        .reduce((sum, trans) => sum + trans.totalAmount, 0);
    });
    
    const filteredProfitTotal = computed(() => {
      return filteredTransactions.value
        .filter(trans => trans.type === 'Sale')
        .reduce((sum, trans) => sum + calculateSaleProfit(trans), 0);
    });
    
    // Watch for changes in report filters
    watch([reportMonth, reportYear], () => {
      updateCharts();
    });
    
    // Methods
    const login = async () => {
      try {
        await auth.signInWithEmailAndPassword(loginEmail.value, loginPassword.value);
      } catch (error) {
        alert('Login failed: ' + error.message);
      }
    };
    
    const register = async () => {
      if (registerPassword.value !== registerConfirm.value) {
        alert('Passwords do not match');
        return;
      }
      
      try {
        await auth.createUserWithEmailAndPassword(registerEmail.value, registerPassword.value);
        showRegister.value = false;
      } catch (error) {
        alert('Registration failed: ' + error.message);
      }
    };
    
    const logout = async () => {
      try {
        await auth.signOut();
      } catch (error) {
        alert('Logout failed: ' + error.message);
      }
    };
    
    const formatDate = (dateString) => {
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    };
    
    const getProductName = (productId) => {
      const product = products.value.find(p => p.id === productId);
      return product ? product.name : 'Unknown Product';
    };
    
    const getCustomerName = (customerId) => {
      const customer = customers.value.find(c => c.id === customerId);
      return customer ? customer.name : 'Unknown Customer';
    };
    
    const getCustomerTotalPurchases = (customerId) => {
      return sales.value
        .filter(sale => sale.customerId === customerId)
        .reduce((sum, sale) => sum + sale.totalAmount, 0);
    };
    
    const calculateSaleProfit = (sale) => {
      let profit = 0;
      
      sale.items.forEach(item => {
        const product = products.value.find(p => p.id === item.productId);
        if (product) {
          profit += (item.unitPrice - product.purchasePrice) * item.quantity;
        }
      });
      
      return profit;
    };
    
    // Product methods
    const addProduct = () => {
      productForm.value = {
        id: '',
        name: '',
        category: '',
        purchasePrice: 0,
        sellingPrice: 0,
        stock: 0
      };
      editingProduct.value = false;
      showAddProductModal.value = true;
    };
    
    const editProduct = (product) => {
      productForm.value = { ...product };
      editingProduct.value = true;
      showAddProductModal.value = true;
    };
    
    const saveProduct = async () => {
      try {
        if (editingProduct.value) {
          await db.collection('products').doc(productForm.value.id).update(productForm.value);
        } else {
          const docRef = await db.collection('products').add(productForm.value);
          await db.collection('products').doc(docRef.id).update({ id: docRef.id });
        }
        showAddProductModal.value = false;
      } catch (error) {
        alert('Error saving product: ' + error.message);
      }
    };
    
    const confirmDeleteProduct = (productId) => {
      confirmMessage.value = 'Are you sure you want to delete this product?';
      confirmAction.value = async () => {
        try {
          await db.collection('products').doc(productId).delete();
          $('#confirmModal').modal('hide');
        } catch (error) {
          alert('Error deleting product: ' + error.message);
        }
      };
      $('#confirmModal').modal('show');
    };
    
    // Purchase methods
    const addPurchase = () => {
      purchaseForm.value = {
        date: new Date().toISOString().split('T')[0],
        supplier: '',
        productId: products.value.length ? products.value[0].id : '',
        quantity: 1,
        unitPrice: 0
      };
      showAddPurchaseModal.value = true;
    };
    
    const savePurchase = async () => {
      try {
        // Add purchase
        const purchaseData = { ...purchaseForm.value };
        const docRef = await db.collection('purchases').add(purchaseData);
        await db.collection('purchases').doc(docRef.id).update({ id: docRef.id });
        
        // Update product stock
        const productRef = db.collection('products').doc(purchaseData.productId);
        const productDoc = await productRef.get();
        if (productDoc.exists) {
          const currentStock = productDoc.data().stock || 0;
          await productRef.update({ stock: currentStock + parseInt(purchaseData.quantity) });
        }
        
        showAddPurchaseModal.value = false;
      } catch (error) {
        alert('Error saving purchase: ' + error.message);
      }
    };
    
    const confirmDeletePurchase = (purchaseId) => {
      confirmMessage.value = 'Are you sure you want to delete this purchase? This will also adjust the product stock.';
      confirmAction.value = async () => {
        try {
          const purchaseDoc = await db.collection('purchases').doc(purchaseId).get();
          if (purchaseDoc.exists) {
            const purchaseData = purchaseDoc.data();
            
            // Update product stock
            const productRef = db.collection('products').doc(purchaseData.productId);
            const productDoc = await productRef.get();
            if (productDoc.exists) {
              const currentStock = productDoc.data().stock || 0;
              await productRef.update({ stock: currentStock - parseInt(purchaseData.quantity) });
            }
            
            // Delete purchase
            await db.collection('purchases').doc(purchaseId).delete();
          }
          $('#confirmModal').modal('hide');
        } catch (error) {
          alert('Error deleting purchase: ' + error.message);
        }
      };
      $('#confirmModal').modal('show');
    };
    
    // Sale methods
    const addSale = () => {
      saleForm.value = {
        date: new Date().toISOString().split('T')[0],
        customerId: customers.value.length ? customers.value[0].id : '',
        items: [{ productId: products.value.length ? products.value[0].id : '', quantity: 1, unitPrice: 0 }],
        totalAmount: 0
      };
      showAddSaleModal.value = true;
    };
    
    const addSaleItem = () => {
      saleForm.value.items.push({
        productId: products.value.length ? products.value[0].id : '',
        quantity: 1,
        unitPrice: 0
      });
    };
    
    const removeSaleItem = (index) => {
      saleForm.value.items.splice(index, 1);
      calculateSaleTotal();
    };
    
    const updateItemPrice = (index) => {
      const product = products.value.find(p => p.id === saleForm.value.items[index].productId);
      if (product) {
        saleForm.value.items[index].unitPrice = product.sellingPrice;
        calculateSaleTotal();
      }
    };
    
    const updateItemTotal = (index) => {
      calculateSaleTotal();
    };
    
    const calculateSaleTotal = () => {
      saleForm.value.totalAmount = saleForm.value.items.reduce((sum, item) => {
        return sum + (item.quantity * item.unitPrice);
      }, 0);
    };
    
    const saveSale = async () => {
      try {
        // Prepare sale data
        const saleData = { 
          ...saleForm.value,
          customerName: getCustomerName(saleForm.value.customerId),
          items: saleForm.value.items.map(item => ({
            ...item,
            productName: getProductName(item.productId)
          }))
        };
        
        // Add sale
        const docRef = await db.collection('sales').add(saleData);
        await db.collection('sales').doc(docRef.id).update({ id: docRef.id });
        
        // Update product stocks
        for (const item of saleData.items) {
          const productRef = db.collection('products').doc(item.productId);
          const productDoc = await productRef.get();
          if (productDoc.exists) {
            const currentStock = productDoc.data().stock || 0;
            await productRef.update({ stock: currentStock - parseInt(item.quantity) });
          }
        }
        
        showAddSaleModal.value = false;
      } catch (error) {
        alert('Error saving sale: ' + error.message);
      }
    };
    
    const confirmDeleteSale = (saleId) => {
      confirmMessage.value = 'Are you sure you want to delete this sale? This will also adjust the product stocks.';
      confirmAction.value = async () => {
        try {
          const saleDoc = await db.collection('sales').doc(saleId).get();
          if (saleDoc.exists) {
            const saleData = saleDoc.data();
            
            // Update product stocks
            for (const item of saleData.items) {
              const productRef = db.collection('products').doc(item.productId);
              const productDoc = await productRef.get();
              if (productDoc.exists) {
                const currentStock = productDoc.data().stock || 0;
                await productRef.update({ stock: currentStock + parseInt(item.quantity) });
              }
            }
            
            // Delete sale
            await db.collection('sales').doc(saleId).delete();
          }
          $('#confirmModal').modal('hide');
        } catch (error) {
          alert('Error deleting sale: ' + error.message);
        }
      };
      $('#confirmModal').modal('show');
    };
    
    // Customer methods
    const addCustomer = () => {
      customerForm.value = {
        id: '',
        name: '',
        email: '',
        phone: ''
      };
      editingCustomer.value = false;
      showAddCustomerModal.value = true;
    };
    
    const editCustomer = (customer) => {
      customerForm.value = { ...customer };
      editingCustomer.value = true;
      showAddCustomerModal.value = true;
    };
    
    const saveCustomer = async () => {
      try {
        if (editingCustomer.value) {
          await db.collection('customers').doc(customerForm.value.id).update(customerForm.value);
        } else {
          const docRef = await db.collection('customers').add(customerForm.value);
          await db.collection('customers').doc(docRef.id).update({ id: docRef.id });
        }
        showAddCustomerModal.value = false;
      } catch (error) {
        alert('Error saving customer: ' + error.message);
      }
    };
    
    const confirmDeleteCustomer = (customerId) => {
      confirmMessage.value = 'Are you sure you want to delete this customer?';
      confirmAction.value = async () => {
        try {
          await db.collection('customers').doc(customerId).delete();
          $('#confirmModal').modal('hide');
        } catch (error) {
          alert('Error deleting customer: ' + error.message);
        }
      };
      $('#confirmModal').modal('show');
    };
    
    // Report methods
    const updateCharts = () => {
      // Sales chart
      const salesCtx = document.getElementById('salesChart');
      
      // Filter sales data by selected month/year
      let filteredSales = sales.value;
      if (reportMonth.value || reportYear.value) {
        filteredSales = sales.value.filter(sale => {
          const saleDate = new Date(sale.date);
          const monthMatch = !reportMonth.value || (saleDate.getMonth() + 1 === parseInt(reportMonth.value));
          const yearMatch = !reportYear.value || (saleDate.getFullYear() === parseInt(reportYear.value));
          return monthMatch && yearMatch;
        });
      }
      
      // Group by day for the chart
      const salesByDay = {};
      filteredSales.forEach(sale => {
        const date = new Date(sale.date);
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const key = `${day}/${month}/${year}`;
        
        if (!salesByDay[key]) {
          salesByDay[key] = {
            date: key,
            amount: 0,
            profit: 0
          };
        }
        
        salesByDay[key].amount += sale.totalAmount;
        salesByDay[key].profit += calculateSaleProfit(sale);
      });
      
      const chartData = Object.values(salesByDay).sort((a, b) => {
        const [aDay, aMonth, aYear] = a.date.split('/').map(Number);
        const [bDay, bMonth, bYear] = b.date.split('/').map(Number);
        return new Date(aYear, aMonth - 1, aDay) - new Date(bYear, bMonth - 1, bDay);
      });
      
      if (salesChart) {
        salesChart.destroy();
      }
      
      salesChart = new Chart(salesCtx, {
        type: 'bar',
        data: {
          labels: chartData.map(item => item.date),
          datasets: [
            {
              label: 'Sales Amount',
              data: chartData.map(item => item.amount),
              backgroundColor: 'rgba(78, 115, 223, 0.5)',
              borderColor: 'rgba(78, 115, 223, 1)',
              borderWidth: 1
            },
            {
              label: 'Profit',
              data: chartData.map(item => item.profit),
              backgroundColor: 'rgba(28, 200, 138, 0.5)',
              borderColor: 'rgba(28, 200, 138, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
      
      // Products chart
      const productsCtx = document.getElementById('productsChart');
      
      // Calculate product sales
      const productSales = {};
      filteredSales.forEach(sale => {
        sale.items.forEach(item => {
          if (!productSales[item.productId]) {
            productSales[item.productId] = {
              name: item.productName,
              quantity: 0,
              revenue: 0
            };
          }
          
          productSales[item.productId].quantity += item.quantity;
          productSales[item.productId].revenue += item.quantity * item.unitPrice;
        });
      });
      
      const topProducts = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      
      if (productsChart) {
        productsChart.destroy();
      }
      
      productsChart = new Chart(productsCtx, {
        type: 'doughnut',
        data: {
          labels: topProducts.map(item => item.name),
          datasets: [{
            data: topProducts.map(item => item.revenue),
            backgroundColor: [
              'rgba(78, 115, 223, 0.5)',
              'rgba(28, 200, 138, 0.5)',
              'rgba(54, 185, 204, 0.5)',
              'rgba(246, 194, 62, 0.5)',
              'rgba(231, 74, 59, 0.5)'
            ],
            borderColor: [
              'rgba(78, 115, 223, 1)',
              'rgba(28, 200, 138, 1)',
              'rgba(54, 185, 204, 1)',
              'rgba(246, 194, 62, 1)',
              'rgba(231, 74, 59, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    };
    
    // Initialize data
    const fetchData = () => {
      // Products
      db.collection('products').onSnapshot(snapshot => {
        products.value = snapshot.docs.map(doc => doc.data());
      });
      
      // Purchases
      db.collection('purchases').onSnapshot(snapshot => {
        purchases.value = snapshot.docs.map(doc => doc.data());
      });
      
      // Sales
      db.collection('sales').onSnapshot(snapshot => {
        sales.value = snapshot.docs.map(doc => doc.data());
      });
      
      // Customers
      db.collection('customers').onSnapshot(snapshot => {
        customers.value = snapshot.docs.map(doc => doc.data());
      });
    };
    
    // Initialize authentication state listener
    auth.onAuthStateChanged(user => {
      isAuthenticated.value = !!user;
      if (user) {
        userEmail.value = user.email;
        fetchData();
      } else {
        products.value = [];
        purchases.value = [];
        sales.value = [];
        customers.value = [];
      }
    });
    
    // Initialize modals when shown
    watch(showAddProductModal, (val) => {
      if (val) {
        $('#productModal').modal('show');
      } else {
        $('#productModal').modal('hide');
      }
    });
    
    watch(showAddPurchaseModal, (val) => {
      if (val) {
        $('#purchaseModal').modal('show');
      } else {
        $('#purchaseModal').modal('hide');
      }
    });
    
    watch(showAddSaleModal, (val) => {
      if (val) {
        $('#saleModal').modal('show');
      } else {
        $('#saleModal').modal('hide');
      }
    });
    
    watch(showAddCustomerModal, (val) => {
      if (val) {
        $('#customerModal').modal('show');
      } else {
        $('#customerModal').modal('hide');
      }
    });
    
    // Initialize on mount
    onMounted(() => {
      // Set current year as default for reports
      reportYear.value = new Date().getFullYear();
      
      // Initialize modals
      $('#productModal').on('hidden.bs.modal', () => {
        showAddProductModal.value = false;
      });
      
      $('#purchaseModal').on('hidden.bs.modal', () => {
        showAddPurchaseModal.value = false;
      });
      
      $('#saleModal').on('hidden.bs.modal', () => {
        showAddSaleModal.value = false;
      });
      
      $('#customerModal').on('hidden.bs.modal', () => {
        showAddCustomerModal.value = false;
      });
      
      $('#confirmModal').on('hidden.bs.modal', () => {
        confirmMessage.value = '';
        confirmAction.value = () => {};
      });
    });
    
    return {
      // Authentication
      isAuthenticated,
      userEmail,
      loginEmail,
      loginPassword,
      registerEmail,
      registerPassword,
      registerConfirm,
      showRegister,
      login,
      register,
      logout,
      
      // Navigation
      currentView,
      
      // Data
      products,
      purchases,
      sales,
      customers,
      
      // Forms
      productForm,
      purchaseForm,
      saleForm,
      customerForm,
      
      // UI states
      showAddProductModal,
      showAddPurchaseModal,
      showAddSaleModal,
      showAddCustomerModal,
      editingProduct,
      editingCustomer,
      confirmMessage,
      confirmAction,
      
      // Reports
      reportMonth,
      reportYear,
      months,
      availableYears,
      
      // Computed
      totalProducts,
      totalStockValue,
      monthlySales,
      monthlyProfit,
      lowStockProducts,
      recentSales,
      filteredTransactions,
      filteredSalesTotal,
      filteredProfitTotal,
      
      // Methods
      formatDate,
      getProductName,
      getCustomerName,
      getCustomerTotalPurchases,
      calculateSaleProfit,
      
      // Product methods
      addProduct,
      editProduct,
      saveProduct,
      confirmDeleteProduct,
      
      // Purchase methods
      addPurchase,
      savePurchase,
      confirmDeletePurchase,
      
      // Sale methods
      addSale,
      addSaleItem,
      removeSaleItem,
      updateItemPrice,
      updateItemTotal,
      calculateSaleTotal,
      saveSale,
      confirmDeleteSale,
      
      // Customer methods
      addCustomer,
      editCustomer,
      saveCustomer,
      confirmDeleteCustomer,
      
      // Report methods
      updateCharts
    };
  }
}).mount('#app');
