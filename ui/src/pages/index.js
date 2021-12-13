import Box from "@mui/material/Box";

export default function Home() {
  return (
    <Box
      sx={{
        maxWidth: "lg",
        m: "auto",
      }}
    >
      <Box my={20}>
        <Box
          sx={{
            textAlign: "center",
            fontSize: 50,
          }}
        >
          CodePod
        </Box>
        <Box sx={{ textAlign: "center", fontSize: 50 }}>
          Your next IDE doesn't edit files
        </Box>
      </Box>

      <Box>
        <Box sx={{ fontSize: 30 }}>Lipsums</Box>
        <Box>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer
          luctus fringilla urna accumsan sollicitudin. Proin tellus eros,
          imperdiet vitae justo ut, blandit vulputate sapien. Proin feugiat
          dolor sed ligula interdum mollis. Curabitur laoreet elementum
          efficitur. Proin id laoreet lacus, sit amet mattis libero. Mauris eget
          ultrices enim, ut bibendum dolor. Ut eu lorem mattis, imperdiet turpis
          a, porta ante. Maecenas rutrum, urna eu sollicitudin sagittis, dui
          lacus porta augue, sed faucibus ipsum mauris sed metus. In consequat
          odio ac bibendum scelerisque. Vivamus non tortor sagittis ligula
          ullamcorper aliquam ut quis arcu. Fusce nec lorem ac tellus malesuada
          laoreet. Suspendisse sit amet tellus vel dolor malesuada semper in nec
          justo.
        </Box>
        <Box>
          Suspendisse id elit sodales, efficitur dolor id, dapibus dui.
          Curabitur sed metus orci. Nunc bibendum sapien sed auctor posuere.
          Duis ut nisl scelerisque, blandit est condimentum, laoreet massa.
          Aliquam tincidunt fermentum nunc id tempor. Phasellus laoreet lacus
          vel ipsum malesuada blandit. Proin massa mi, imperdiet sit amet urna
          ut, eleifend condimentum dolor. Sed at urna augue. Suspendisse
          potenti. Donec quis erat et leo vehicula laoreet ac id libero.
        </Box>
      </Box>
    </Box>
  );
}
